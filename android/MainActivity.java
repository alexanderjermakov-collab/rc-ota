package com.scem.rcota;



import android.Manifest;

import android.app.*;

import android.os.*;

import android.content.*;

import android.content.pm.PackageManager;

import android.bluetooth.*;

import android.bluetooth.le.*;

import android.net.Uri;

import android.graphics.Color;

import android.view.*;

import android.webkit.*;

import android.widget.*;

import org.json.*;

import java.io.*;

import java.util.*;



/** WebView UI with a main-frame, exact-origin MessagePort and native BLE. */

public class MainActivity extends Activity {

    static final String ONLINE="https://appassets.androidplatform.net";

    static final String LOCAL="https://appassets.androidplatform.net";

    static final UUID SERVICE=UUID.fromString("01231000-445c-11e5-9e03-2b0350a13921");

    static final UUID WRITE=UUID.fromString("01231001-445c-11e5-9e03-2b0350a13921");

    static final UUID NOTIFY=UUID.fromString("01231002-445c-11e5-9e03-2b0350a13921");

    static UUID uuid(String shortId){return UUID.fromString("0000"+shortId+"-0000-1000-8000-00805f9b34fb");}

    final Handler handler=new Handler(Looper.getMainLooper());

    android.webkit.ValueCallback<Uri[]> fileCallback; String exportText;

    BluetoothDevice target,pendingBond; boolean resumed=false,restoreAttempted=false;

    final Runnable bondTimeout=()->{pendingBond=null;status("Android pairing timed out. Confirm the system dialog or choose the remote again.");};

    String bondState(){if(target==null||!permitted())return "unknown";int b=target.getBondState();return b==BluetoothDevice.BOND_BONDED?"bonded":b==BluetoothDevice.BOND_BONDING?"bonding":"none";}

    final BroadcastReceiver bondReceiver=new BroadcastReceiver(){@Override public void onReceive(Context c,Intent i){

      if(!BluetoothDevice.ACTION_BOND_STATE_CHANGED.equals(i.getAction())||pendingBond==null||!permitted())return;

      BluetoothDevice d=i.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);if(d==null||!d.getAddress().equals(pendingBond.getAddress()))return;

      int state=d.getBondState();if(state==BluetoothDevice.BOND_BONDED){handler.removeCallbacks(bondTimeout);status("Android pairing confirmed. Preparing GATT connection.");if(resumed){pendingBond=null;openGatt(d);}}

      else if(state==BluetoothDevice.BOND_NONE){handler.removeCallbacks(bondTimeout);pendingBond=null;status("Android pairing failed or was cancelled. No connected status was reported.");}

      else status("Android pairing in progress. Confirm the system Bluetooth dialog.");

    }};

    void restoreSaved(){if(restoreAttempted||!resumed||!permitted()||adapter==null||!adapter.isEnabled()||gatt!=null||pendingBond!=null)return;restoreAttempted=true;

      String address=getPreferences(0).getString("lastRemote",null);if(address==null){BluetoothDevice only=null;int count=0;for(BluetoothDevice d:adapter.getBondedDevices()){String n=d.getName();if(n!=null&&n.toLowerCase(java.util.Locale.ROOT).contains("sharp")){only=d;count++;}}if(count==1){connect(only);}else if(count>1)status("Several paired SHARP remotes found. Choose the intended remote once.");return;}

      try{BluetoothDevice d=adapter.getRemoteDevice(address);if(d.getBondState()==BluetoothDevice.BOND_BONDED){status("Saved Android pairing found. Reconnecting without pairing again.");connect(d);}else status("Saved remote is not paired in Android. Choose the remote to pair it.");}catch(Exception e){status("Saved remote unavailable. Choose a remote.");}}

    void connectSavedOrChoose(){if(!permitted()){chooseRemote();return;}if(connected){sendStatus();return;}if(pendingBond!=null||gatt!=null){status("A connection or pairing attempt is already running.");return;}restoreAttempted=false;restoreSaved();if(gatt==null&&pendingBond==null)chooseRemote();}

    WebView web; WebMessagePort port; BluetoothAdapter adapter; BluetoothGatt gatt;

    BluetoothGattCharacteristic writer; boolean connected=false, scanning=false, opBusy=false;

    JSONObject metadata=new JSONObject(); String status="Select Connect remote to use Android Bluetooth.";

    final ArrayDeque<GattOp> operations=new ArrayDeque<>();

    interface GattOp { boolean start(); }

    final ArrayList<BluetoothDevice> devices=new ArrayList<>();

    final ArrayList<String> labels=new ArrayList<>();

    ArrayAdapter<String> deviceRows; AlertDialog picker;

    final Runnable opTimeout=()->disconnect("Bluetooth operation timed out. Reconnect the remote.");

    final Runnable connectTimeout=()->disconnect("Connection timed out. Wake the remote and try again.");

    final Runnable stopScanTask=()->stopScan();

    final Runnable heartbeat=()->{};



    @Override public void onCreate(Bundle state){

        super.onCreate(state);

        IntentFilter bondFilter=new IntentFilter(BluetoothDevice.ACTION_BOND_STATE_CHANGED);

        if(Build.VERSION.SDK_INT>=33)registerReceiver(bondReceiver,bondFilter,Context.RECEIVER_EXPORTED);else registerReceiver(bondReceiver,bondFilter);

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        getWindow().getDecorView().setSystemUiVisibility(5894);

        adapter=((BluetoothManager)getSystemService(BLUETOOTH_SERVICE)).getAdapter();

        LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(Color.rgb(12,17,20));

        LinearLayout bar=new LinearLayout(this);

        addButton(bar,"RC OTA",()->open(LOCAL+"/index.html"));

        addButton(bar,"Disconnect",()->disconnect("Remote disconnected."));

        addButton(bar,"Connect remote",()->connectSavedOrChoose());

        addButton(bar,"Reload",()->web.reload());

        root.addView(bar,new LinearLayout.LayoutParams(-1,(int)(48*getResources().getDisplayMetrics().density)));

        web=new WebView(this);root.addView(web,new LinearLayout.LayoutParams(-1,0,1));setContentView(root);

        WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);

        settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        settings.setUseWideViewPort(true);settings.setLoadWithOverviewMode(true);settings.setTextZoom(100);

        web.setBackgroundColor(Color.rgb(12,17,20));web.setWebChromeClient(new WebChromeClient(){

 @Override public boolean onConsoleMessage(ConsoleMessage m){android.util.Log.i("RCOTA-WEB",m.message());return true;}

 @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> cb,FileChooserParams params){if(fileCallback!=null)fileCallback.onReceiveValue(null);fileCallback=cb;try{startActivityForResult(new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("application/octet-stream"),41);}catch(Exception e){cb.onReceiveValue(null);fileCallback=null;}return true;}

 });

        web.setWebViewClient(new WebViewClient(){

            @Override public void onPageStarted(WebView v,String url,android.graphics.Bitmap favicon){closePort();disconnect("Select Connect remote to use Android Bluetooth.");}

            @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest req){return !"https".equals(req.getUrl().getScheme());}

            @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest req){

                Uri uri=req.getUrl();if(!LOCAL.equals(origin(uri)))return null;

                String path=uri.getPath();if(path==null||path.contains(".."))return missing();

                if(path.equals("/"))path="/index.html";

                try {String mime=path.endsWith(".js")?"text/javascript":path.endsWith(".css")?"text/css":path.endsWith(".json")?"application/json":path.endsWith(".png")?"image/png":"text/html";

                    return new WebResourceResponse(mime,"UTF-8",getAssets().open("web"+path));

                }catch(IOException e){return missing();}

            }

            @Override public void onPageFinished(WebView v,String url){if(trusted(url))attachBridge(url);}

            @Override public void onReceivedError(WebView v,WebResourceRequest req,WebResourceError error){if(req.isForMainFrame())Toast.makeText(MainActivity.this,"Page unavailable. Use RC OTA for RC OTA.",Toast.LENGTH_LONG).show();}

        });

        // Always usable on first run, without requiring a TV-browser login session.

        open(LOCAL+"/index.html");

    }

    void addButton(LinearLayout bar,String text,Runnable action){Button b=new Button(this);b.setText(text);b.setTextSize(12);b.setPadding(0,0,0,0);b.setOnClickListener(v->action.run());bar.addView(b,new LinearLayout.LayoutParams(0,-1,1));}

    void open(String url){web.loadUrl(url);}

    static String origin(Uri uri){return uri.getScheme()+"://"+uri.getHost()+(uri.getPort()==-1?"":":"+uri.getPort());}

    static boolean trusted(String url){if(url==null)return false;Uri u=Uri.parse(url);String o=origin(u),p=u.getPath();return (ONLINE.equals(o)||LOCAL.equals(o))&&(p==null||p.equals("/")||p.equals("/index.html"));}

    WebResourceResponse missing(){return new WebResourceResponse("text/plain","UTF-8",404,"Not found",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));}

    void closePort(){if(port!=null){port.close();port=null;}}

    void attachBridge(String url){

        closePort();WebMessagePort[] pair=web.createWebMessageChannel();port=pair[0];

        port.setWebMessageCallback(new WebMessagePort.WebMessageCallback(){@Override public void onMessage(WebMessagePort source,WebMessage msg){

            if(source!=port||!trusted(web.getUrl()))return;

            try{JSONObject j=new JSONObject(msg.getData());String type=j.optString("type");

                if(type.equals("hello")){android.util.Log.i("RCOTA","Bridge handshake complete");sendStatus();sendMetadata();restoreSaved();}

                else if(type.equals("export")){exportText=j.optJSONObject("value").toString(2);startActivityForResult(new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("application/json").putExtra(Intent.EXTRA_TITLE,"rc-ota-diagnostics.json"),42);}

                else if(type.equals("connect"))connectSavedOrChoose();

                else if(type.equals("choose"))chooseRemote();

                else if(type.equals("disconnect"))disconnect("Remote disconnected.");

                else if(type.equals("oem"))new AlertDialog.Builder(MainActivity.this).setTitle("Open original RemoteUpdate?").setMessage("The installed manufacturer application will control the update. Continue there only after checking the selected firmware.").setNegativeButton("Cancel",null).setPositiveButton("Open",(d,w)->{disconnect("Opening original RemoteUpdate.");try {startActivity(new Intent().setClassName("com.airoha.btd","com.airoha.android.bluetoothlegatt.MainActivity"));}catch(Exception e){status("Original RemoteUpdate is not installed.");}}).show();

            }catch(Exception ignored){}

        }},handler);

        web.postWebMessage(new WebMessage("rcota-native-v1",new WebMessagePort[]{pair[1]}),Uri.parse(origin(Uri.parse(url))));

    }

    void send(JSONObject message){if(port!=null&&trusted(web.getUrl()))try{port.postMessage(new WebMessage(message.toString()));}catch(IllegalStateException ignored){}}

    JSONObject object(String key,Object value){JSONObject j=new JSONObject();try{j.put(key,value);}catch(JSONException ignored){}return j;}

    void put(JSONObject j,String key,Object value){try{j.put(key,value);}catch(JSONException ignored){}}

    void sendStatus(){JSONObject j=object("type","status");put(j,"connected",connected);put(j,"connecting",pendingBond!=null||(gatt!=null&&!connected));put(j,"bondState",bondState());put(j,"oemAvailable",getPackageManager().getLaunchIntentForPackage("com.airoha.btd")!=null);put(j,"message",status);send(j);}

    void sendMetadata(){android.util.Log.i("RCOTA","Metadata: "+metadata.toString());JSONObject j=object("type","metadata");put(j,"value",metadata);send(j);}

    void status(String message){status=message;android.util.Log.i("RCOTA",message);sendStatus();}



    boolean permitted(){return Build.VERSION.SDK_INT<31?checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED:checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)==PackageManager.PERMISSION_GRANTED&&checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN)==PackageManager.PERMISSION_GRANTED;}

    void chooseRemote(){

        if(!trusted(web.getUrl())){Toast.makeText(this,"Open the dashboard before connecting Bluetooth.",Toast.LENGTH_LONG).show();return;}

        if(!permitted()){requestPermissions(Build.VERSION.SDK_INT>=31?new String[]{Manifest.permission.BLUETOOTH_CONNECT,Manifest.permission.BLUETOOTH_SCAN}:new String[]{Manifest.permission.ACCESS_FINE_LOCATION},10);return;}

        if(adapter==null||!adapter.isEnabled()){status("Enable Bluetooth in TV settings, then reconnect.");return;}

        if(pendingBond!=null||gatt!=null&&!connected){status("Connection is already in progress. Wake the selected remote and wait.");return;}

        if(picker!=null&&picker.isShowing())return;

        devices.clear();labels.clear();deviceRows=new ArrayAdapter<>(this,android.R.layout.simple_list_item_1,labels);

        for(BluetoothDevice d:adapter.getBondedDevices())addDevice(d);

        picker=new AlertDialog.Builder(this).setTitle("Select remote for RC OTA").setAdapter(deviceRows,(dialog,index)->{stopScan();connect(devices.get(index));}).setNegativeButton("Cancel",(d,w)->status("Connection cancelled.")).create();

        picker.setOnDismissListener(d->stopScan());picker.show();

        status("Select your remote in the device list. Scanning for 15 seconds.");

        try{BluetoothLeScanner scanner=adapter.getBluetoothLeScanner();if(scanner!=null){scanning=true;scanner.startScan(scanCallback);handler.postDelayed(stopScanTask,15000);}}catch(SecurityException e){status("Bluetooth scan permission is required.");}

    }

    @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] results){super.onRequestPermissionsResult(request,permissions,results);if(request==10){if(permitted())connectSavedOrChoose();else status("Nearby devices permission is required. Select Connect remote to try again.");}}

    void addDevice(BluetoothDevice d){for(BluetoothDevice x:devices)if(x.getAddress().equals(d.getAddress()))return;String name=d.getName();if(name==null||name.isEmpty()||!name.toLowerCase(java.util.Locale.ROOT).contains("sharp"))return;devices.add(d);labels.add(name+"\n"+d.getAddress());if(deviceRows!=null)deviceRows.notifyDataSetChanged();}

    final ScanCallback scanCallback=new ScanCallback(){@Override public void onScanResult(int type,ScanResult result){handler.post(()->addDevice(result.getDevice()));}@Override public void onScanFailed(int code){handler.post(()->status("Scan unavailable ("+code+"). You can select a paired remote."));}};

    void stopScan(){handler.removeCallbacks(stopScanTask);if(scanning){scanning=false;try{adapter.getBluetoothLeScanner().stopScan(scanCallback);}catch(Exception ignored){}}}

    void connect(BluetoothDevice device){

      disconnect("Preparing "+device.getName()+"...");target=device;put(metadata,"name",device.getName());put(metadata,"address",device.getAddress());sendMetadata();

      if(device.getBondState()==BluetoothDevice.BOND_BONDED){status("Already paired in Android. Opening GATT without pairing again.");openGatt(device);return;}

      pendingBond=device;handler.postDelayed(bondTimeout,60000);

      if(device.getBondState()==BluetoothDevice.BOND_BONDING){status("Existing Android pairing is still in progress. Waiting for confirmation.");return;}

      status("Starting Android pairing. Confirm the system Bluetooth dialog.");

      if(!device.createBond()){handler.removeCallbacks(bondTimeout);pendingBond=null;status("Android could not start pairing. Wake the remote and retry.");}

    }

    void openGatt(BluetoothDevice device){if(!permitted()||device.getBondState()!=BluetoothDevice.BOND_BONDED){status("Android pairing is not complete. GATT was not started.");return;}target=device;pendingBond=null;handler.removeCallbacks(bondTimeout);gatt=device.connectGatt(this,false,callback,BluetoothDevice.TRANSPORT_LE);status("Paired in Android. Connecting to remote GATT...");handler.postDelayed(connectTimeout,25000);}

    void disconnect(String reason){

        pendingBond=null;handler.removeCallbacks(bondTimeout);

        handler.removeCallbacks(heartbeat);handler.removeCallbacks(opTimeout);handler.removeCallbacks(connectTimeout);

        operations.clear();opBusy=false;connected=false;writer=null;metadata=new JSONObject();

        BluetoothGatt old=gatt;gatt=null;if(old!=null){try{old.disconnect();}catch(Exception ignored){}old.close();}status(reason);

    }

    void enqueue(GattOp operation){operations.add(operation);next();}

    void next(){if(opBusy||gatt==null||operations.isEmpty())return;opBusy=true;handler.postDelayed(opTimeout,8000);try{if(!operations.remove().start())disconnect("Bluetooth operation could not start. Reconnect the remote.");}catch(Exception e){disconnect("Bluetooth operation failed: "+e.getClass().getSimpleName());}}

    void done(){handler.removeCallbacks(opTimeout);opBusy=false;if(operations.isEmpty()&&gatt!=null&&!connected){if(metadata.has("model")||metadata.has("firmware")||metadata.has("software")||metadata.has("level")){connected=true;getPreferences(0).edit().putString("lastRemote",target.getAddress()).apply();status("Android paired; live GATT read verified. No firmware was written.");}else status("Android paired, but no live characteristic read was confirmed. GATT is not verified.");}next();}

    void read(UUID service,String id){BluetoothGattService s=gatt.getService(service);if(s==null)return;BluetoothGattCharacteristic c=s.getCharacteristic(uuid(id));if(c!=null)enqueue(()->gatt.readCharacteristic(c));}

    final BluetoothGattCallback callback=new BluetoothGattCallback(){

        @Override public void onConnectionStateChange(BluetoothGatt g,int result,int state){handler.post(()->{if(g!=gatt)return;if(result!=BluetoothGatt.GATT_SUCCESS||state==BluetoothProfile.STATE_DISCONNECTED){disconnect("Remote disconnected ("+result+"). Select Connect remote to retry.");return;}if(state==BluetoothProfile.STATE_CONNECTED&&!g.discoverServices())disconnect("Could not discover remote services.");});}

        @Override public void onServicesDiscovered(BluetoothGatt g,int result){handler.post(()->{

            if(g!=gatt)return;if(result!=BluetoothGatt.GATT_SUCCESS){disconnect("Service discovery failed.");return;}

            if(target==null||target.getBondState()!=BluetoothDevice.BOND_BONDED||g.getServices().isEmpty()){disconnect("Pairing or service discovery was not confirmed.");return;}

            handler.removeCallbacks(connectTimeout);

            JSONArray services=new JSONArray();

            for(BluetoothGattService s:g.getServices()) {JSONObject info=object("uuid",s.getUuid().toString());JSONArray chars=new JSONArray();for(BluetoothGattCharacteristic c:s.getCharacteristics()){JSONObject item=object("uuid",c.getUuid().toString());put(item,"properties",c.getProperties());chars.put(item);}put(info,"characteristics",chars);services.put(info);}

            JSONObject report=object("type","services");put(report,"value",services);send(report);android.util.Log.i("RCOTA","Services: "+services.toString());

            status("Android pairing confirmed. Verifying live device information...");

            read(uuid("180a"),"2a24");read(uuid("180a"),"2a26");read(uuid("180a"),"2a28");read(uuid("180f"),"2a19");if(!opBusy&&operations.isEmpty())status("Android paired, but no standard readable information was found. GATT is not verified.");

        });}

        @Override public void onCharacteristicRead(BluetoothGatt g,BluetoothGattCharacteristic c,int result){byte[] value=c.getValue();handler.post(()->{if(g!=gatt)return;if(result==BluetoothGatt.GATT_SUCCESS&&value!=null){String id=c.getUuid().toString();if(id.equals(uuid("2a19").toString())){int level=value.length>0?value[0]&255:255;if(level<=100)put(metadata,"level",level);}else{String text=new String(value,java.nio.charset.StandardCharsets.UTF_8).replace("\u0000","").trim();if(!text.isEmpty())put(metadata,id.equals(uuid("2a24").toString())?"model":id.equals(uuid("2a26").toString())?"firmware":"software",text);}sendMetadata();}done();});}

        @Override public void onCharacteristicChanged(BluetoothGatt g,BluetoothGattCharacteristic c){if(!NOTIFY.equals(c.getUuid()))return;byte[] value=c.getValue();if(value==null)return;byte[] copy=value.clone();handler.post(()->{if(g!=gatt)return;JSONObject j=object("type","data");JSONArray bytes=new JSONArray();for(byte b:copy)bytes.put(b&255);put(j,"bytes",bytes);send(j);});}

    };

    @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(request==41&&fileCallback!=null){fileCallback.onReceiveValue(result==RESULT_OK&&data!=null?new Uri[]{data.getData()}:null);fileCallback=null;}if(request==42&&result==RESULT_OK&&data!=null&&exportText!=null){try(java.io.OutputStream stream=getContentResolver().openOutputStream(data.getData())){stream.write(exportText.getBytes(java.nio.charset.StandardCharsets.UTF_8));}catch(Exception e){status("Could not save diagnostics.");}exportText=null;}}

    @Override protected void onResume(){super.onResume();resumed=true;if(pendingBond!=null&&permitted()&&pendingBond.getBondState()==BluetoothDevice.BOND_BONDED){BluetoothDevice d=pendingBond;pendingBond=null;openGatt(d);}else if(web!=null&&trusted(web.getUrl())){handler.post(()->restoreSaved());}}

    @Override protected void onStop(){super.onStop();resumed=false;stopScan();if(picker!=null)picker.dismiss();if(pendingBond==null){disconnect("App paused. Saved Android pairing is retained.");restoreAttempted=false;}}

    @Override protected void onDestroy(){try{unregisterReceiver(bondReceiver);}catch(Exception ignored){}closePort();handler.removeCallbacksAndMessages(null);web.destroy();super.onDestroy();}

    @Override public void onBackPressed(){if(web.canGoBack())web.goBack();else super.onBackPressed();}

}

