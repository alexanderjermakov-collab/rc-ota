param([ValidateSet('probe','dry-run','flash')][string]$Action='probe',
 [string]$Address='',[string]$ExpectedModel='',[string]$ExpectedCurrentFirmware='',
 [string]$FirmwarePath='',[string]$ExpectedSha256='',[string]$ExpectedMd5='')
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
[ComImport, Guid("905a0fe0-bc53-11df-8c49-001e4fc686da"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IBufferNative {
    void GetIids(out uint count, out IntPtr ids);
    void GetRuntimeClassName(out IntPtr name);
    void GetTrustLevel(out int level);
    void GetCapacity(out uint capacity);
    void GetLength(out uint length);
    void SetLength(uint length);
}
[ComImport, Guid("905a0fef-bc53-11df-8c49-001e4fc686da"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IBufferBytes { void Buffer(out IntPtr bytes); }
public static class RemoteBuffer {
    public static byte[] Copy(object value) {
        uint length; ((IBufferNative)value).GetLength(out length);
        IntPtr pointer; ((IBufferBytes)value).Buffer(out pointer);
        var bytes = new byte[length]; Marshal.Copy(pointer, bytes, 0, bytes.Length); return bytes;
    }
}
'@
$null = [Windows.Devices.Bluetooth.BluetoothLEDevice,Windows.Devices.Bluetooth,ContentType=WindowsRuntime]
$null = [Windows.Devices.Bluetooth.GenericAttributeProfile.GattDeviceServicesResult,Windows.Devices.Bluetooth,ContentType=WindowsRuntime]
$null = [Windows.Devices.Bluetooth.GenericAttributeProfile.GattCharacteristicsResult,Windows.Devices.Bluetooth,ContentType=WindowsRuntime]
$null = [Windows.Devices.Bluetooth.GenericAttributeProfile.GattReadResult,Windows.Devices.Bluetooth,ContentType=WindowsRuntime]
$null = [Windows.Storage.Streams.DataReader,Windows.Storage.Streams,ContentType=WindowsRuntime]
$null = [Windows.Storage.Streams.IBuffer,Windows.Storage.Streams,ContentType=WindowsRuntime]
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
function Await-WinRT($operation, [Type]$resultType) {
    $task = $asTask.MakeGenericMethod($resultType).Invoke($null,@($operation))
    if (-not $task.Wait(15000)) { throw 'Native Bluetooth operation exceeded 15 seconds.' }
    return $task.Result
}

Add-Type -TypeDefinition @'
using System;
public static class TelinkFrames {
 public static ushort Crc(byte[] bytes,int count) {
  int value=65535;
  for(int n=0;n<count;n++){value^=bytes[n];for(int bit=0;bit<8;bit++)value=(value>>1)^((value&1)!=0?0xa001:0);}
  return (ushort)value;
 }
 public static byte[] Packet(byte[] firmware,int index) {
  var packet=new byte[20];for(int n=0;n<20;n++)packet[n]=255;
  packet[0]=(byte)index;packet[1]=(byte)(index>>8);
  Array.Copy(firmware,index*16,packet,2,Math.Min(16,firmware.Length-index*16));
  var crc=Crc(packet,18);packet[18]=(byte)crc;packet[19]=(byte)(crc>>8);return packet;
 }
 public static byte[] End(int lastIndex) {
  int inverse=(~lastIndex)&65535;
  var packet=new byte[]{2,255,(byte)lastIndex,(byte)(lastIndex>>8),(byte)inverse,(byte)(inverse>>8),0,0};
  var crc=Crc(packet,6);packet[6]=(byte)crc;packet[7]=(byte)(crc>>8);return packet;
 }
}
'@
function Emit($value){$value | ConvertTo-Json -Depth 6 -Compress | Write-Output}
function Hex($bytes){[BitConverter]::ToString($bytes).Replace('-','').ToLowerInvariant()}
$device=$null;$opened=@();$began=$false
try {
 $firmware=$null
 if($Action -ne 'probe') {
  $fullPath=[IO.Path]::GetFullPath($FirmwarePath)
  $allowed=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '.runtime/firmware'))+[IO.Path]::DirectorySeparatorChar
  if(-not $fullPath.StartsWith($allowed,[StringComparison]::OrdinalIgnoreCase)){throw 'Firmware must be a package verified by this application.'}
  if($ExpectedSha256 -notmatch '^[a-fA-F0-9]{64}$' -or $ExpectedMd5 -notmatch '^[a-fA-F0-9]{32}$'){throw 'Verified package hashes are required.'}
  $firmware=[IO.File]::ReadAllBytes($fullPath)
  if($firmware.Length -lt 16 -or $firmware.Length -gt 1048576){throw 'Firmware must be between 16 bytes and 1 MiB for this Telink packet format.'}
  $sha=[Security.Cryptography.SHA256]::Create();$md5=[Security.Cryptography.MD5]::Create()
  try{if((Hex ($sha.ComputeHash($firmware))) -ne $ExpectedSha256 -or (Hex ($md5.ComputeHash($firmware))) -ne $ExpectedMd5){throw 'Cached firmware hashes no longer match the verified package.'}}finally{$sha.Dispose();$md5.Dispose()}
  $count=[int][Math]::Ceiling($firmware.Length/16.0)
  if($Action -eq 'dry-run') {
   Emit @{state='dry-run';packets=$count;first=(Hex ([TelinkFrames]::Packet($firmware,0)));last=(Hex ([TelinkFrames]::Packet($firmware,$count-1)));end=(Hex ([TelinkFrames]::End($count-1)));bytes=$firmware.Length}
   exit
  }
 }
 if($Address -notmatch '^[a-fA-F0-9]{12}$' -or [string]::IsNullOrWhiteSpace($ExpectedModel)){throw 'An exact paired remote address and model are required.'}
 $device=Await-WinRT ([Windows.Devices.Bluetooth.BluetoothLEDevice]::FromBluetoothAddressAsync([Convert]::ToUInt64($Address,16))) ([Windows.Devices.Bluetooth.BluetoothLEDevice])
 if(-not $device -or -not $device.DeviceInformation.Pairing.IsPaired -or $device.Name -notmatch '^SHARP(?: SOLAR)? RCU$'){throw 'The selected SHARP remote is not paired in Windows.'}
 $result=Await-WinRT ($device.GetGattServicesAsync([Windows.Devices.Bluetooth.BluetoothCacheMode]::Cached)) ([Windows.Devices.Bluetooth.GenericAttributeProfile.GattDeviceServicesResult])
 if([string]$result.Status -ne 'Success'){throw ('Service discovery failed: '+$result.Status)}
 $opened=@($result.Services)
 function Characteristic([string]$serviceUuid,[string]$characteristicUuid) {
  $service=$opened|Where-Object{$_.Uuid.ToString() -eq $serviceUuid}|Select-Object -First 1
  if(-not $service){throw ('Required service is not present: '+$serviceUuid)}
  $chars=Await-WinRT ($service.GetCharacteristicsAsync([Windows.Devices.Bluetooth.BluetoothCacheMode]::Cached)) ([Windows.Devices.Bluetooth.GenericAttributeProfile.GattCharacteristicsResult])
  if([string]$chars.Status -ne 'Success'){throw ('Characteristic discovery failed: '+$chars.Status)}
  $characteristic=$chars.Characteristics|Where-Object{$_.Uuid.ToString() -eq $characteristicUuid}|Select-Object -First 1
  if(-not $characteristic){throw ('Required characteristic is not present: '+$characteristicUuid)}
  return $characteristic
 }
 function ReadBytes($characteristic) {
  $read=Await-WinRT ($characteristic.ReadValueAsync([Windows.Devices.Bluetooth.BluetoothCacheMode]::Uncached)) ([Windows.Devices.Bluetooth.GenericAttributeProfile.GattReadResult])
  if([string]$read.Status -ne 'Success'){throw ('Live read failed: '+$read.Status)}
  return ,([RemoteBuffer]::Copy($read.Value))
 }
 $model=[Text.Encoding]::UTF8.GetString((ReadBytes (Characteristic '0000180a-0000-1000-8000-00805f9b34fb' '00002a24-0000-1000-8000-00805f9b34fb'))).Trim([char]0).Trim()
 if($model -cne $ExpectedModel){throw 'The live remote model does not match the verified firmware model.'}
 $installed=[Text.Encoding]::UTF8.GetString((ReadBytes (Characteristic '0000180a-0000-1000-8000-00805f9b34fb' '00002a26-0000-1000-8000-00805f9b34fb'))).Trim([char]0).Trim()
 $battery=ReadBytes (Characteristic '0000180f-0000-1000-8000-00805f9b34fb' '00002a19-0000-1000-8000-00805f9b34fb')
 if(-not $battery.Length -or $battery[0] -gt 100 -or $battery[0] -lt 30){throw 'The remote must report at least 30% battery (OEM Telink minimum).'}
 if($ExpectedCurrentFirmware -and $installed -cne $ExpectedCurrentFirmware){throw 'Installed firmware changed. Read the remote and prepare the upgrade again.'}
 $ota=Characteristic '00010203-0405-0607-0809-0a0b0c0d1912' '00010203-0405-0607-0809-0a0b0c0d2b12'
 $properties=[string]$ota.CharacteristicProperties
 if($properties -notmatch 'WriteWithoutResponse' -or $properties -notmatch 'Read'){throw 'The required Telink OTA read/write-without-response properties are unavailable.'}
 # Resolve WinRT write overloads and buffers during a read-only probe, without invoking a write.
 $null=[Windows.Devices.Bluetooth.GenericAttributeProfile.GattCommunicationStatus,Windows.Devices.Bluetooth,ContentType=WindowsRuntime]
 $null=[Windows.Devices.Bluetooth.GenericAttributeProfile.GattWriteOption,Windows.Devices.Bluetooth,ContentType=WindowsRuntime]
 $buffer=[System.Runtime.InteropServices.WindowsRuntime.WindowsRuntimeBufferExtensions]::AsBuffer([byte[]](0,255))
 if($Action -eq 'probe'){Emit @{state='probe-ok';model=$model;installed=$installed;battery=[int]$battery[0];service=$ota.Service.Uuid.ToString();characteristic=$ota.Uuid.ToString();properties=$properties;writesPerformed=0};exit}
 function WritePacket([byte[]]$bytes) {
  $buffer=[System.Runtime.InteropServices.WindowsRuntime.WindowsRuntimeBufferExtensions]::AsBuffer($bytes)
  $status=Await-WinRT ($ota.WriteValueAsync($buffer,[Windows.Devices.Bluetooth.GenericAttributeProfile.GattWriteOption]::WriteWithoutResponse)) ([Windows.Devices.Bluetooth.GenericAttributeProfile.GattCommunicationStatus])
  if([string]$status -ne 'Success'){throw ('OTA write failed: '+$status)}
 }
 $clock=[Diagnostics.Stopwatch]::StartNew();$lastProgress=-1
 Emit @{state='starting';progress=0;message='Sending OEM Telink OTA prepare and start commands.'}
 $began=$true
 WritePacket ([byte[]](0,255))
 WritePacket ([byte[]](1,255))
 for($index=0;$index -lt $count;$index++) {
  if($clock.Elapsed.TotalSeconds -gt 300){throw 'OTA transfer exceeded the OEM 300-second timeout.'}
  WritePacket ([TelinkFrames]::Packet($firmware,$index))
  # OEM Device.java reads back after every eight non-final packets for flow control.
  if(($index+1)%8 -eq 0 -and $index -ne $count-1){$null=ReadBytes $ota}
  $progress=[Math]::Min(99,[int][Math]::Floor(($index+1)*100.0/$count))
  if($progress -ne $lastProgress){Emit @{state='transferring';progress=$progress;sentBytes=[Math]::Min(($index+1)*16,$firmware.Length);bytes=$firmware.Length};$lastProgress=$progress}
 }
 WritePacket ([TelinkFrames]::End($count-1))
 Emit @{state='transfer-sent';progress=100;bytes=$firmware.Length;message='OTA frames sent. Installation must be verified by reading the firmware version after reconnect.'}
}catch {
 Emit @{state='error';message=$_.Exception.Message;writesMayHaveStarted=$began}
 exit 1
}finally {
 foreach($service in $opened){$service.Dispose()}
 if($device){$device.Dispose()}
}
