param([ValidateSet('list','read')][string]$Action='list',[string]$Address='')
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
$null = [Windows.Devices.Enumeration.DeviceInformation,Windows.Devices.Enumeration,ContentType=WindowsRuntime]
$null = [Windows.Devices.Enumeration.DeviceInformationCollection,Windows.Devices.Enumeration,ContentType=WindowsRuntime]
if ($Action -eq 'list') {
    try {
        $selector=[Windows.Devices.Bluetooth.BluetoothLEDevice]::GetDeviceSelectorFromPairingState($true)
        $items=Await-WinRT ([Windows.Devices.Enumeration.DeviceInformation]::FindAllAsync($selector)) ([Windows.Devices.Enumeration.DeviceInformationCollection])
        $remotes=@()
        foreach($item in $items) {
            if($item.Name -notmatch '^SHARP(?:\s|$)'){continue}
            $remote=$null
            try {
                $remote=Await-WinRT ([Windows.Devices.Bluetooth.BluetoothLEDevice]::FromIdAsync($item.Id)) ([Windows.Devices.Bluetooth.BluetoothLEDevice])
                if($remote -and $remote.DeviceInformation.Pairing.IsPaired){$remotes+=@{name=$remote.Name;address=$remote.BluetoothAddress.ToString('X12')}}
            } finally {if($remote){$remote.Dispose()}}
        }
        @{devices=@($remotes)} | ConvertTo-Json -Depth 5
    } catch { @{error=$_.Exception.Message;devices=@()} | ConvertTo-Json -Depth 5 }
    exit
}
if($Address -notmatch '^[A-Fa-f0-9]{12}$'){throw 'A paired remote Bluetooth address is required.'}
$device = $null
$opened = @()
$report = [ordered]@{ checkedAt=(Get-Date).ToString('o'); source='Windows WinRT read-only GATT'; services=@(); readings=@(); serviceDetails=@() }
try {
    $device = Await-WinRT ([Windows.Devices.Bluetooth.BluetoothLEDevice]::FromBluetoothAddressAsync([Convert]::ToUInt64($Address,16))) ([Windows.Devices.Bluetooth.BluetoothLEDevice])
    if ($null -eq $device) { throw 'Windows did not return the paired remote.' }
    $report.name=$device.Name
    $report.paired=$device.DeviceInformation.Pairing.IsPaired
    if(-not $report.paired -or $device.Name -notmatch '^SHARP(?:\s|$)'){throw 'Select a supported SHARP remote already paired in Windows.'}
    $report.connectionStatus=[string]$device.ConnectionStatus
    $cacheMode=[Windows.Devices.Bluetooth.BluetoothCacheMode]::Cached
    $report.discoveryMode=[string]$cacheMode
    $result = Await-WinRT ($device.GetGattServicesAsync($cacheMode)) ([Windows.Devices.Bluetooth.GenericAttributeProfile.GattDeviceServicesResult])
    $report.serviceStatus=[string]$result.Status
    $report.serviceProtocolError=$result.ProtocolError
    $opened=@($result.Services)
    $report.services=@($opened | ForEach-Object { [string]$_.Uuid })
    foreach ($service in $opened) {
        $serviceId=$service.Uuid.ToString()
        if ($serviceId -notin @('0000180a-0000-1000-8000-00805f9b34fb','0000180f-0000-1000-8000-00805f9b34fb')) { continue }
        $chars=Await-WinRT ($service.GetCharacteristicsAsync([Windows.Devices.Bluetooth.BluetoothCacheMode]::Cached)) ([Windows.Devices.Bluetooth.GenericAttributeProfile.GattCharacteristicsResult])
        $report.serviceDetails+=,@{uuid=$serviceId;characteristics=@($chars.Characteristics|ForEach-Object{@{uuid=$_.Uuid.ToString();properties=$_.CharacteristicProperties.ToString()}})}
        if($chars.Status -ne [Windows.Devices.Bluetooth.GenericAttributeProfile.GattCommunicationStatus]::Success){continue}
        foreach ($characteristic in $chars.Characteristics) {
            $uuid=$characteristic.Uuid.ToString()
            $field=switch ($uuid.Substring(4,4)) { '2a24' {'model'} '2a26' {'firmware'} '2a28' {'software'} '2a27' {'hardware'} '2a29' {'manufacturer'} '2a19' {'battery'} default { $null } }
            if (-not $field) { continue }
            $reading=[ordered]@{field=$field;uuid=$uuid;properties=[string]$characteristic.CharacteristicProperties}
            try {
                $read=Await-WinRT ($characteristic.ReadValueAsync([Windows.Devices.Bluetooth.BluetoothCacheMode]::Uncached)) ([Windows.Devices.Bluetooth.GenericAttributeProfile.GattReadResult])
                $reading.status=[string]$read.Status
                $reading.protocolError=$read.ProtocolError
                if ($read.Status -eq [Windows.Devices.Bluetooth.GenericAttributeProfile.GattCommunicationStatus]::Success) {
                    $bytes=[RemoteBuffer]::Copy($read.Value)
                    $reading.value=if($field -eq 'battery' -and $bytes.Length){[int]$bytes[0]}else{[Text.Encoding]::UTF8.GetString($bytes).Trim([char]0).Trim()}
                }
            } catch { $reading.error=$_.Exception.Message }
            $report.readings+=,$reading
        }
    }
    $report.finalConnectionStatus=[string]$device.ConnectionStatus
} catch { $report.error=$_.Exception.Message }
finally {
    foreach($service in $opened){$service.Dispose()}
    if($null -ne $device){$device.Dispose()}
}
$report | ConvertTo-Json -Depth 8
