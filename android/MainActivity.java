package com.scem.rcota;
import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.widget.*;

/** Launcher only: the HTML interface is rendered by an external browser. */
public class MainActivity extends Activity {
 BridgeService bridge;boolean bound,openWhenReady;TextView state;
 final ServiceConnection connection=new ServiceConnection(){public void onServiceConnected(ComponentName n,IBinder b){bridge=((BridgeService.LocalBinder)b).service();state.setText(bridge.error!=null?bridge.error:"Local BLE Bridge ready at "+LocalHttpServer.ORIGIN+". Open Chrome to view RC OTA.");if(openWhenReady){openWhenReady=false;openBrowser("com.android.chrome");}}public void onServiceDisconnected(ComponentName n){bridge=null;state.setText("Bridge stopped. Start it again to reconnect.");}};
 @Override public void onCreate(Bundle saved){super.onCreate(saved);LinearLayout root=new LinearLayout(this);root.setOrientation(1);root.setPadding(24,24,24,24);state=new TextView(this);state.setTextSize(20);state.setText("RC OTA 0.7.0 — HTML in your browser; Bluetooth in the local Android service.");root.addView(state);button(root,"Start bridge and open Chrome",()->{openWhenReady=true;startBridge();});button(root,"Open TV browser",()->{if(bridge==null){openWhenReady=false;startBridge();Toast.makeText(this,"Bridge starting. Press Open TV browser again when ready.",Toast.LENGTH_LONG).show();}else openBrowser("com.phlox.tvwebbrowser");});if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)button(root,"Allow bridge notification",()->requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},11));button(root,"Android Bluetooth settings",()->startActivity(new Intent(Settings.ACTION_BLUETOOTH_SETTINGS)));button(root,"Stop bridge",()->{if(bound){unbindService(connection);bound=false;}bridge=null;stopService(new Intent(this,BridgeService.class));state.setText("BLE bridge stopped.");});setContentView(root);}
 void button(LinearLayout root,String text,Runnable action){Button b=new Button(this);b.setText(text);b.setOnClickListener(v->action.run());root.addView(b);}
 boolean allowed(){return Build.VERSION.SDK_INT<31||checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)==PackageManager.PERMISSION_GRANTED;}
 void startBridge(){if(!allowed()){requestPermissions(new String[]{Manifest.permission.BLUETOOTH_CONNECT},10);return;}if(bridge!=null){if(openWhenReady){openWhenReady=false;openBrowser("com.android.chrome");}return;}Intent i=new Intent(this,BridgeService.class);try{startForegroundService(i);if(!bound)bound=bindService(i,connection,Context.BIND_AUTO_CREATE);}catch(Exception e){state.setText("Cannot start bridge: "+e.getMessage());}}
 void openBrowser(String pkg){if(bridge==null||bridge.error!=null){state.setText(bridge==null?"Start the bridge first.":bridge.error);return;}try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(bridge.launchUrl())).setPackage(pkg));}catch(ActivityNotFoundException e){state.setText(pkg.equals("com.android.chrome")?"Chrome is not installed. Install Chrome, or use Open TV browser to test the local HTML interface on this TV.":"TV Bro is not installed. Install a supported browser to open the local HTML interface.");}}
 @Override public void onRequestPermissionsResult(int r,String[] p,int[] result){super.onRequestPermissionsResult(r,p,result);if(r==10){if(allowed())startBridge();else state.setText("Allow Nearby devices so the bridge can read already-paired remotes.");}}
 @Override protected void onStop(){if(bound){unbindService(connection);bound=false;}bridge=null;super.onStop();}
 @Override protected void onDestroy(){if(bound)unbindService(connection);super.onDestroy();}
}
