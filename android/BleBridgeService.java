package com.scem.rcota;

import android.Manifest;
import android.app.*;
import android.os.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.bluetooth.*;
import android.util.Base64;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.*;
import java.util.concurrent.*;

/** Owns GATT and OTA catalog requests; Chrome uses an authenticated loopback API. */
public class BleBridgeService extends Service {
    static volatile BleBridgeService instance;
    static volatile String startupError;
    volatile boolean ready;
    volatile String message="Starting bridge…";
    final Handler handler=new Handler(Looper.getMainLooper());
    final ExecutorService otaExecutor=Executors.newSingleThreadExecutor();
    final ArrayDeque<BluetoothGattCharacteristic> reads=new ArrayDeque<>();
    final JSONArray trace=new JSONArray();
    BluetoothAdapter adapter;BluetoothGatt gatt;BluetoothDevice target;
    BluetoothGattCharacteristic activeRead;LocalHttpServer server;
    String token,stage="idle";
    JSONObject metadata=new JSONObject(),ota=new JSONObject();
    JSONArray services=new JSONArray();
    long readAt;
    boolean gattConnected,verified,stopping,restoreAttempted;
    int otaGeneration;
    final Runnable connectTimeout=()->disconnect("Connection timed out. Wake the remote and select Connect.","error");
    final Runnable readTimeout=()->disconnect("GATT read timed out. Wake the remote and reconnect.","error");
    static UUID uuid(String id){return UUID.fromString("0000"+id+"-0000-1000-8000-00805f9b34fb");}
    static JSONObject obj(Object... pairs){JSONObject value=new JSONObject();for(int i=0;i<pairs.length;i+=2)put(value,(String)pairs[i],pairs[i+1]);return value;}
    static void put(JSONObject value,String key,Object data){try{value.put(key,data);}catch(JSONException e){throw new IllegalArgumentException(e);}}
    boolean permitted(){return Build.VERSION.SDK_INT<31||checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)==PackageManager.PERMISSION_GRANTED;}
    boolean enabled(){try{return adapter!=null&&permitted()&&adapter.isEnabled();}catch(SecurityException e){return false;}}
    String launchUrl(){return LocalHttpServer.ORIGIN+"/#token="+token;}

    @Override public void onCreate(){
        super.onCreate();instance=this;startupError=null;
        try{
            if(!permitted())throw new SecurityException("Nearby devices permission is required. Open RC OTA to grant access.");
            NotificationManager manager=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
            manager.createNotificationChannel(new NotificationChannel("ble-bridge","RC OTA BLE Bridge",NotificationManager.IMPORTANCE_LOW));
            PendingIntent open=PendingIntent.getActivity(this,0,new Intent(this,MainActivity.class),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
            PendingIntent stop=PendingIntent.getService(this,1,new Intent(this,BleBridgeService.class).setAction("STOP"),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
            Notification notification=new Notification.Builder(this,"ble-bridge").setSmallIcon(android.R.drawable.stat_sys_data_bluetooth).setContentTitle("RC OTA BLE Bridge running").setContentText("Chrome can read your paired SHARP remote. Tap to open controls.").setContentIntent(open).setOngoing(true).addAction(new Notification.Action.Builder(null,"Stop bridge",stop).build()).build();
            if(Build.VERSION.SDK_INT>=29)startForeground(7,notification,ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE);else startForeground(7,notification);
            BluetoothManager bluetooth=(BluetoothManager)getSystemService(BLUETOOTH_SERVICE);adapter=bluetooth==null?null:bluetooth.getAdapter();
            byte[] random=new byte[32];new SecureRandom().nextBytes(random);token=Base64.encodeToString(random,Base64.NO_WRAP|Base64.NO_PADDING|Base64.URL_SAFE);
            server=new LocalHttpServer(token,this::route);server.start();ready=true;status("Bridge ready. Reading paired SHARP remotes.");handler.post(this::restore);
        }catch(Exception e){startupError=e instanceof java.net.BindException?"Port 18764 is already in use. Stop the other bridge and try again.":"Bridge could not start: "+e.getMessage();message=startupError;stopSelf();}
    }
    @Override public int onStartCommand(Intent intent,int flags,int id){if(intent!=null&&"STOP".equals(intent.getAction()))stopSelf();return START_NOT_STICKY;}
    @Override public IBinder onBind(Intent intent){return null;}
    LocalHttpServer.Response route(String method,String path,String body)throws Exception{
        if(path.startsWith("/api/")){
            FutureTask<LocalHttpServer.Response> task=new FutureTask<>(()->api(method,path,body));handler.post(task);
            try{return task.get(3,TimeUnit.SECONDS);}catch(Exception e){task.cancel(false);throw e;}
        }
        if(!"GET".equals(method))return LocalHttpServer.error(405,"Method not allowed");
        String file,mime;
        switch(path){case "/":case "/index.html":file="local/index.html";mime="text/html; charset=utf-8";break;case "/local.js":file="local/app.js";mime="text/javascript; charset=utf-8";break;case "/local.css":file="local/style.css";mime="text/css; charset=utf-8";break;case "/customer-ui.js":file="customer-ui.js";mime="text/javascript; charset=utf-8";break;case "/ota.js":file="ota.js";mime="text/javascript; charset=utf-8";break;default:return LocalHttpServer.error(404,"Not found");}
        try(InputStream in=getAssets().open("web/"+file);ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] bytes=new byte[4096];int n;while((n=in.read(bytes))!=-1)out.write(bytes,0,n);return new LocalHttpServer.Response(200,mime,out.toByteArray());}
    }
    LocalHttpServer.Response api(String method,String path,String body){
        if(stopping||!ready)return LocalHttpServer.error(503,"Bridge is stopping");
        if("/api/state".equals(path))return "GET".equals(method)?LocalHttpServer.Response.json(200,snapshot().toString()):LocalHttpServer.error(405,"Use GET for state");
        if(!"POST".equals(method))return LocalHttpServer.error(405,"Use POST for bridge commands");
        JSONObject request;try{request=new JSONObject(body);}catch(JSONException e){return LocalHttpServer.error(400,"Invalid JSON");}
        switch(path){
            case "/api/connect":
                if(!permitted())return LocalHttpServer.error(403,"Nearby devices permission was revoked. Open RC OTA to grant it.");
                if(!enabled())return LocalHttpServer.error(400,"Enable Bluetooth in Android settings, then retry.");
                String address=request.optString("address","");if(address.isEmpty())restoreAttempted=false;
                try{BluetoothDevice selected=null;for(BluetoothDevice device:adapter.getBondedDevices())if(RemotePolicy.supported(device.getName())&&device.getAddress().equals(address))selected=device;
                    if(selected!=null)connect(selected);else if(address.isEmpty())restore();else return LocalHttpServer.error(400,"Selected remote is no longer paired. Refresh the list or pair it in Android settings.");
                }catch(SecurityException e){return LocalHttpServer.error(403,"Bluetooth permission is required");}
                return LocalHttpServer.Response.json(202,snapshot().toString());
            case "/api/disconnect":disconnect("Disconnected. Last read data is retained.","disconnected");return LocalHttpServer.Response.json(200,snapshot().toString());
            case "/api/ota":String model=request.optString("model","").trim();if(model.isEmpty()||model.length()>80||model.matches(".*[\\x00-\\x1f/\\\\].*"))return LocalHttpServer.error(400,"Exact remote model is required");checkOta(model);return LocalHttpServer.Response.json(202,snapshot().toString());
            default:return LocalHttpServer.error(404,"Unknown API command");
        }
    }
    void status(String text){message=text;if(trace.length()>=200)trace.remove(0);trace.put(obj("timeMillis",System.currentTimeMillis(),"message",text));android.util.Log.i("RCOTA",text);}
    JSONArray bonded(){JSONArray rows=new JSONArray();if(!enabled())return rows;for(BluetoothDevice device:adapter.getBondedDevices())if(RemotePolicy.supported(device.getName()))rows.put(obj("name",device.getName(),"address",device.getAddress(),"paired",true));return rows;}
    String bondState(){try{return target!=null&&permitted()&&target.getBondState()==BluetoothDevice.BOND_BONDED?"bonded":"unknown";}catch(SecurityException e){return "unknown";}}
    JSONObject snapshot(){
        JSONArray devices=new JSONArray();try{devices=bonded();}catch(SecurityException ignored){}
        if(gatt!=null&&(!permitted()||!enabled()))disconnect("Bluetooth is unavailable or its permission was revoked. Open RC OTA or Android settings.","error");
        return obj("version","0.7.0","transport","Local Android BLE Bridge","serviceRunning",ready,"connectPermission",permitted(),"bluetoothAvailable",adapter!=null,"bluetoothEnabled",enabled(),"devices",devices,"selectedAddress",target==null?"":target.getAddress(),"bondState",bondState(),"stage",stage,"gattConnected",gattConnected,"verified",verified,"message",message,"metadata",metadata,"readAt",readAt,"dataStale",!verified,"services",services,"ota",ota,"trace",trace);
    }
    void restore(){
        if(restoreAttempted||gatt!=null||stopping)return;if(!enabled()){status("Enable Bluetooth in Android settings, then select Connect.");return;}restoreAttempted=true;
        try{ArrayList<BluetoothDevice> devices=new ArrayList<>(adapter.getBondedDevices());String[] names=new String[devices.size()],addresses=new String[devices.size()];int count=0;
            for(int i=0;i<devices.size();i++){names[i]=devices.get(i).getName();addresses[i]=devices.get(i).getAddress();if(RemotePolicy.supported(names[i]))count++;}
            int chosen=RemotePolicy.select(names,addresses,getSharedPreferences("MainActivity",0).getString("lastRemote",null));
            if(chosen>=0)connect(devices.get(chosen));else{stage=count>0?"paired":"idle";status(count>1?"Several paired SHARP remotes found. Choose one in the list.":"Pair SHARP RCU or SHARP SOLAR RCU in Android Bluetooth settings, then refresh the list.");}
        }catch(SecurityException e){status("Nearby devices permission is required. Open RC OTA to grant it.");}
    }
    void connect(BluetoothDevice device){
        if(!enabled())return;
        if(gatt!=null&&target!=null&&target.getAddress().equals(device.getAddress())){status("This remote is already connected or connecting. Wake it and wait, or disconnect to retry.");return;}
        if(device.getBondState()!=BluetoothDevice.BOND_BONDED||!RemotePolicy.supported(device.getName())){status("Pair a supported SHARP remote in Android settings first.");return;}
        disconnect("Preparing paired remote…","paired");target=device;metadata=obj("name",device.getName(),"address",device.getAddress());services=new JSONArray();readAt=0;ota=new JSONObject();
        getSharedPreferences("MainActivity",0).edit().putString("lastRemote",device.getAddress()).apply();stage="connecting";status("Paired in Android. Connecting directly to GATT; keep the remote awake.");
        try{gatt=device.connectGatt(this,false,callback,BluetoothDevice.TRANSPORT_LE);if(gatt==null){stage="error";status("Android could not start GATT. Wake the remote and retry.");}else handler.postDelayed(connectTimeout,25000);}
        catch(Exception e){disconnect("GATT connection failed: "+e.getClass().getSimpleName(),"error");}
    }
    void disconnect(String text,String nextStage){
        handler.removeCallbacks(connectTimeout);handler.removeCallbacks(readTimeout);reads.clear();activeRead=null;gattConnected=false;verified=false;otaGeneration++;
        if("checking".equals(ota.optString("state")))put(ota,"state","cancelled");
        BluetoothGatt old=gatt;gatt=null;if(old!=null){try{old.disconnect();}catch(Exception ignored){}try{old.close();}catch(Exception ignored){}}
        stage=nextStage;status(text);
    }
    void addRead(String service,String id){BluetoothGattService s=gatt.getService(uuid(service));BluetoothGattCharacteristic c=s==null?null:s.getCharacteristic(uuid(id));if(c!=null&&(c.getProperties()&BluetoothGattCharacteristic.PROPERTY_READ)!=0)reads.add(c);}
    void nextRead(){
        if(gatt==null||activeRead!=null)return;
        if(reads.isEmpty()){verified=readAt>0;stage=verified?"verified":"gatt-connected";status(verified?"Live GATT data verified. No firmware was written.":"GATT connected, but no standard device information could be read. Data is not verified.");if(verified&&metadata.has("model"))checkOta(metadata.optString("model"));return;}
        activeRead=reads.remove();stage="reading";
        try{if(gatt.readCharacteristic(activeRead)){handler.postDelayed(readTimeout,8000);return;}}catch(Exception e){status("GATT read could not start: "+e.getClass().getSimpleName());}
        activeRead=null;handler.post(this::nextRead);
    }
    final BluetoothGattCallback callback=new BluetoothGattCallback(){
        @Override public void onConnectionStateChange(BluetoothGatt link,int result,int state){handler.post(()->{
            if(link!=gatt||stopping)return;
            if(result!=BluetoothGatt.GATT_SUCCESS||state==BluetoothProfile.STATE_DISCONNECTED){disconnect("Remote disconnected ("+result+"). Last read data is retained. Wake it and reconnect.","disconnected");return;}
            if(state==BluetoothProfile.STATE_CONNECTED){gattConnected=true;stage="discovering";status("GATT connected. Discovering services…");try{if(!link.discoverServices())disconnect("Service discovery could not start.","error");}catch(SecurityException e){disconnect("Bluetooth permission was revoked.","error");}}
        });}
        @Override public void onServicesDiscovered(BluetoothGatt link,int result){handler.post(()->{
            if(link!=gatt||stopping)return;if(result!=BluetoothGatt.GATT_SUCCESS||link.getServices().isEmpty()){disconnect("Service discovery failed ("+result+").","error");return;}
            handler.removeCallbacks(connectTimeout);services=new JSONArray();
            for(BluetoothGattService service:link.getServices()){JSONArray chars=new JSONArray();for(BluetoothGattCharacteristic c:service.getCharacteristics())chars.put(obj("uuid",c.getUuid().toString(),"properties",c.getProperties()));services.put(obj("uuid",service.getUuid().toString(),"characteristics",chars));}
            status("Services discovered. Reading model, firmware, software and battery…");addRead("180a","2a24");addRead("180a","2a26");addRead("180a","2a28");addRead("180f","2a19");nextRead();
        });}
        @Override public void onCharacteristicRead(BluetoothGatt link,BluetoothGattCharacteristic c,int result){readResult(link,c,c.getValue(),result);}
        @Override public void onCharacteristicRead(BluetoothGatt link,BluetoothGattCharacteristic c,byte[] bytes,int result){readResult(link,c,bytes,result);}
    };
    void readResult(BluetoothGatt link,BluetoothGattCharacteristic characteristic,byte[] bytes,int result){
        final byte[] value=bytes==null?null:bytes.clone();handler.post(()->{
            if(link!=gatt||stopping||activeRead==null||!activeRead.getUuid().equals(characteristic.getUuid()))return;
            handler.removeCallbacks(readTimeout);activeRead=null;status("GATT read "+characteristic.getUuid()+": status "+result+", bytes "+(value==null?0:value.length));
            if(result==BluetoothGatt.GATT_SUCCESS&&value!=null&&value.length>0){UUID id=characteristic.getUuid();boolean valid=false;
                if(id.equals(uuid("2a19"))){int level=value[0]&255;if(level<=100){put(metadata,"level",level);valid=true;}}
                else{String text=new String(value,StandardCharsets.UTF_8).replace("\u0000","").trim();if(!text.isEmpty()){put(metadata,id.equals(uuid("2a24"))?"model":id.equals(uuid("2a26"))?"firmware":"software",text);valid=true;}}
                if(valid)readAt=System.currentTimeMillis();
            }nextRead();
        });
    }
    void checkOta(String model){
        if("checking".equals(ota.optString("state"))){status("An OTA server check is already running. Wait for it to finish.");return;}
        final int generation=++otaGeneration;ota=obj("state","checking","model",model);status("Checking manufacturer OTA catalog for "+model+"…");
        otaExecutor.execute(()->{JSONObject result;try{result=obj("state","complete","model",model,"checkedAt",System.currentTimeMillis(),"value",OtaCatalog.check(model));}catch(Exception e){result=obj("state","error","model",model,"checkedAt",System.currentTimeMillis(),"error","OTA server check failed: "+e.getMessage());}final JSONObject finished=result;
            handler.post(()->{if(!stopping&&generation==otaGeneration){ota=finished;status("complete".equals(finished.optString("state"))?"OTA server check complete. No firmware was downloaded or installed.":finished.optString("error"));}});
        });
    }
    @Override public void onDestroy(){stopping=true;ready=false;if(server!=null)server.close();disconnect("Bridge stopped.","disconnected");otaExecutor.shutdownNow();handler.removeCallbacksAndMessages(null);if(instance==this)instance=null;stopForeground(true);super.onDestroy();}
}
