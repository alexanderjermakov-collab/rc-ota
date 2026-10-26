package com.scem.rcota;
import android.Manifest;
import android.app.*;
import android.bluetooth.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.os.*;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.*;
import java.util.concurrent.*;

/** Owns the radio while the external browser displays the local HTML interface. */
public class BridgeService extends Service {
 static final String STOP="com.scem.rcota.STOP";
 final Handler main=new Handler(Looper.getMainLooper());
 final IBinder binder=new LocalBinder();
 final ArrayDeque<BluetoothGattCharacteristic> reads=new ArrayDeque<>();
 final JSONArray trace=new JSONArray();
 BluetoothAdapter adapter;BluetoothGatt gatt;BluetoothDevice target;
 LocalHttpServer server;String token,error,message="Bridge starting";
 JSONObject metadata=new JSONObject();JSONArray services=new JSONArray();
 boolean connected,connecting;int liveReads;long lastReadAt;int generation;
 final Runnable timeout=()->disconnect("Bluetooth operation timed out. Wake the selected remote and reconnect.");
 public final class LocalBinder extends Binder { BridgeService service(){return BridgeService.this;} }
 boolean permission(){return Build.VERSION.SDK_INT<31||checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)==PackageManager.PERMISSION_GRANTED;}
 static UUID uuid(String s){return UUID.fromString("0000"+s+"-0000-1000-8000-00805f9b34fb");}
 static JSONObject obj(){return new JSONObject();}
 static void put(JSONObject j,String k,Object v){try{j.put(k,v);}catch(JSONException ignored){}}
 void status(String text){message=text;JSONObject item=obj();put(item,"timeMillis",System.currentTimeMillis());put(item,"message",text);if(trace.length()>=200)trace.remove(0);trace.put(item);android.util.Log.i("RCOTA",text);}
 @Override public void onCreate(){super.onCreate();adapter=((BluetoothManager)getSystemService(BLUETOOTH_SERVICE)).getAdapter();byte[] bytes=new byte[32];new SecureRandom().nextBytes(bytes);token=android.util.Base64.encodeToString(bytes,android.util.Base64.URL_SAFE|android.util.Base64.NO_WRAP|android.util.Base64.NO_PADDING);
  try{if(!permission())throw new SecurityException("Nearby devices permission is required");NotificationManager nm=getSystemService(NotificationManager.class);nm.createNotificationChannel(new NotificationChannel("rcota-bridge","RC OTA BLE Bridge",NotificationManager.IMPORTANCE_LOW));PendingIntent open=PendingIntent.getActivity(this,0,new Intent(this,MainActivity.class),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);PendingIntent stop=PendingIntent.getService(this,1,new Intent(this,BridgeService.class).setAction(STOP),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);Notification note=new Notification.Builder(this,"rcota-bridge").setSmallIcon(android.R.drawable.stat_sys_data_bluetooth).setContentTitle("RC OTA BLE Bridge").setContentText("Local browser interface is running").setContentIntent(open).setOngoing(true).addAction(new Notification.Action.Builder(null,"Stop",stop).build()).build();startForeground(7,note);
   server=new LocalHttpServer(token,this::route);server.start();status("Local Android BLE Bridge ready. No firmware writes are enabled.");main.post(this::restore);
  }catch(Exception e){error="Bridge could not start: "+e.getMessage();status(error);stopSelf();}
 }
 @Override public int onStartCommand(Intent intent,int flags,int id){if(intent!=null&&STOP.equals(intent.getAction()))stopSelf();return START_NOT_STICKY;}
 @Override public IBinder onBind(Intent intent){return binder;}
 String launchUrl(){return LocalHttpServer.ORIGIN+"/#token="+token;}
 <T>T onMain(Callable<T> task)throws Exception{FutureTask<T> call=new FutureTask<>(task);main.post(call);return call.get(3,TimeUnit.SECONDS);}
 LocalHttpServer.Reply route(String method,String path,byte[] body)throws Exception{
  if(method.equals("GET")&&path.equals("/api/state"))return LocalHttpServer.Reply.json(onMain(()->snapshot().toString()));
  if(method.equals("POST")&&path.equals("/api/connect")){JSONObject j=new JSONObject(new String(body,StandardCharsets.UTF_8));String address=j.optString("address");return LocalHttpServer.Reply.json(onMain(()->{connectAddress(address);return snapshot().toString();}));}
  if(method.equals("POST")&&path.equals("/api/disconnect"))return LocalHttpServer.Reply.json(onMain(()->{disconnect("Disconnected by user. Android pairing retained.");return snapshot().toString();}));
  if(method.equals("POST")&&path.equals("/api/ota")){JSONObject j=new JSONObject(new String(body,StandardCharsets.UTF_8));try{return LocalHttpServer.Reply.json(OtaCatalog.check(j.optString("model")).toString());}catch(Exception e){JSONObject result=obj();put(result,"error","OTA server check failed: "+e.getMessage());return LocalHttpServer.Reply.json(result.toString());}}
  if(method.equals("GET")){path=path.split("\\?",2)[0];String file=path.equals("/")?"index.html":path.substring(1);if(!Arrays.asList("index.html","app.js","local-bridge.js","style.css","ota.js","ota-client.js").contains(file))return new LocalHttpServer.Reply(404,"text/plain",new byte[0]);try(InputStream in=getAssets().open("web/"+file);ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1)out.write(b,0,n);return new LocalHttpServer.Reply(200,file.endsWith(".js")?"text/javascript":file.endsWith(".css")?"text/css":"text/html",out.toByteArray());}}
  return new LocalHttpServer.Reply(404,"text/plain",new byte[0]);
 }
 ArrayList<BluetoothDevice> bonded(){ArrayList<BluetoothDevice> list=new ArrayList<>();if(permission()&&adapter!=null&&adapter.isEnabled())for(BluetoothDevice d:adapter.getBondedDevices())if(RemotePolicy.supported(d.getName()))list.add(d);list.sort(Comparator.comparing(BluetoothDevice::getAddress));return list;}
 void restore(){if(gatt!=null)return;if(!permission()){status("Nearby devices permission is required. Open RC OTA launcher.");return;}if(adapter==null||!adapter.isEnabled()){status("Enable Bluetooth in Android settings, then reconnect.");return;}ArrayList<BluetoothDevice> list=bonded();String[] names=new String[list.size()],addresses=new String[list.size()];for(int i=0;i<list.size();i++){names[i]=list.get(i).getName();addresses[i]=list.get(i).getAddress();}int i=RemotePolicy.select(names,addresses,getSharedPreferences("MainActivity",0).getString("lastRemote",null));status("Android bonded-device lookup: "+list.size()+" supported SHARP remotes.");if(i>=0)connect(list.get(i));else status(list.size()>1?"Select the paired remote to connect. No new pairing is needed.":"No supported paired remote found. Pair SHARP RCU or SHARP SOLAR RCU in Android settings.");}
 void connectAddress(String address){if(gatt!=null){status("Disconnect the current remote before changing devices.");return;}if(address.isEmpty()){restore();return;}for(BluetoothDevice d:bonded())if(d.getAddress().equals(address)){connect(d);return;}status("Selected remote is no longer paired or supported. Refresh the paired-device list.");}
 void connect(BluetoothDevice d){metadata=obj();services=new JSONArray();lastReadAt=0;liveReads=0;target=d;connected=false;connecting=true;generation++;put(metadata,"name",d.getName());put(metadata,"address",d.getAddress());getSharedPreferences("MainActivity",0).edit().putString("lastRemote",d.getAddress()).apply();status("Already paired: "+d.getName()+". Opening native GATT without scanning or pairing again.");try{gatt=d.connectGatt(this,false,callback,BluetoothDevice.TRANSPORT_LE);if(gatt==null)disconnect("Android could not create a GATT connection.");else main.postDelayed(timeout,25000);}catch(Exception e){disconnect("GATT connect failed: "+e.getMessage());}}
 void disconnect(String reason){main.removeCallbacks(timeout);reads.clear();connected=false;connecting=false;generation++;BluetoothGatt old=gatt;gatt=null;if(old!=null){try{old.disconnect();}catch(Exception ignored){}old.close();}status(reason);}
 void nextRead(){main.removeCallbacks(timeout);if(gatt==null)return;if(reads.isEmpty()){connecting=false;connected=liveReads>0;status(connected?"Android paired; live GATT reads verified. No firmware was written.":"Paired, but no standard device-information or battery read succeeded.");return;}BluetoothGattCharacteristic c=reads.remove();status("Reading "+c.getUuid());try{if(gatt.readCharacteristic(c)){main.postDelayed(timeout,8000);return;}}catch(Exception e){status("Read could not start: "+e.getClass().getSimpleName());}status("Read could not start for "+c.getUuid());main.post(this::nextRead);}
 void readResult(BluetoothGatt g,BluetoothGattCharacteristic c,byte[] bytes,int code){byte[] value=bytes==null?null:bytes.clone();main.post(()->{if(g!=gatt)return;status("GATT read "+c.getUuid()+": status="+code+", bytes="+(value==null?0:value.length));if(code==BluetoothGatt.GATT_SUCCESS&&value!=null&&value.length>0){if(c.getUuid().equals(uuid("2a19"))){int level=value[0]&255;if(level<=100){put(metadata,"level",level);liveReads++;lastReadAt=System.currentTimeMillis();}}else{String text=new String(value,StandardCharsets.UTF_8).replace("\u0000","").trim();if(!text.isEmpty()){put(metadata,c.getUuid().equals(uuid("2a24"))?"model":c.getUuid().equals(uuid("2a26"))?"firmware":"software",text);liveReads++;lastReadAt=System.currentTimeMillis();}}}nextRead();});}
 final BluetoothGattCallback callback=new BluetoothGattCallback(){
  @Override public void onConnectionStateChange(BluetoothGatt g,int result,int state){main.post(()->{if(g!=gatt)return;status("GATT connection callback: status="+result+", state="+state);if(result!=BluetoothGatt.GATT_SUCCESS||state==BluetoothProfile.STATE_DISCONNECTED){disconnect("Remote GATT disconnected (status "+result+"). Last-read data is retained; wake the remote and reconnect.");return;}if(state==BluetoothProfile.STATE_CONNECTED&&!g.discoverServices())disconnect("Service discovery could not start.");});}
  @Override public void onServicesDiscovered(BluetoothGatt g,int code){main.post(()->{if(g!=gatt)return;if(code!=0){disconnect("Service discovery failed ("+code+").");return;}services=new JSONArray();for(BluetoothGattService s:g.getServices()){JSONObject j=obj();put(j,"uuid",s.getUuid().toString());JSONArray cs=new JSONArray();for(BluetoothGattCharacteristic c:s.getCharacteristics()){JSONObject item=obj();put(item,"uuid",c.getUuid().toString());put(item,"properties",c.getProperties());cs.put(item);}put(j,"characteristics",cs);services.put(j);}status("Discovered "+services.length()+" native GATT services.");String[][] items={{"180a","2a24"},{"180a","2a26"},{"180a","2a28"},{"180f","2a19"}};for(String[] item:items){BluetoothGattService s=g.getService(uuid(item[0]));if(s!=null){BluetoothGattCharacteristic c=s.getCharacteristic(uuid(item[1]));if(c!=null&&(c.getProperties()&BluetoothGattCharacteristic.PROPERTY_READ)!=0)reads.add(c);}}nextRead();});}
  @Override public void onCharacteristicRead(BluetoothGatt g,BluetoothGattCharacteristic c,int status){readResult(g,c,c.getValue(),status);}
  @Override public void onCharacteristicRead(BluetoothGatt g,BluetoothGattCharacteristic c,byte[] value,int status){readResult(g,c,value,status);}
 };
 JSONObject snapshot(){JSONObject j=obj();put(j,"version","0.7.0");put(j,"transport","Local Android BLE Bridge");put(j,"generation",generation);put(j,"metadata",metadata);put(j,"services",services);put(j,"lastReadAt",lastReadAt);put(j,"trace",trace);JSONObject state=obj();put(state,"type","status");put(state,"connected",connected);put(state,"connecting",connecting);put(state,"message",message);put(state,"oemAvailable",false);put(state,"bondState",target==null||!permission()?"unknown":target.getBondState()==BluetoothDevice.BOND_BONDED?"bonded":"none");put(j,"status",state);JSONArray list=new JSONArray();for(BluetoothDevice d:bonded()){JSONObject item=obj();put(item,"name",d.getName());put(item,"address",d.getAddress());list.put(item);}put(j,"devices",list);put(j,"connectPermission",permission());return j;}
 @Override public void onDestroy(){disconnect("Local BLE bridge stopped.");if(server!=null)server.close();main.removeCallbacksAndMessages(null);stopForeground(true);super.onDestroy();}
}
