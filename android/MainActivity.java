package com.scem.rcota;
import android.Manifest;
import android.app.*;
import android.os.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.provider.Settings;
import android.widget.*;

/** Starts the bridge; the HTML interface runs in Chrome, independently of this Activity. */
public class MainActivity extends Activity {
    final Handler handler=new Handler(Looper.getMainLooper());
    TextView status;boolean opening;
    final Runnable refresh=new Runnable(){public void run(){showStatus();handler.postDelayed(this,1000);}};
    boolean permitted(){return Build.VERSION.SDK_INT<31||checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)==PackageManager.PERMISSION_GRANTED;}
    @Override public void onCreate(Bundle state){
        super.onCreate(state);
        LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setPadding(28,28,28,28);root.setBackgroundColor(Color.rgb(12,21,32));
        TextView title=new TextView(this);title.setText("RC OTA 0.7.0 · Test");title.setTextSize(28);title.setTextColor(Color.WHITE);root.addView(title);
        TextView help=new TextView(this);help.setText("Local Android BLE Bridge\n\nPair SHARP RCU or SHARP SOLAR RCU in Android Bluetooth settings. Then open the interface in Chrome. Keep the remote awake during connection.\n\nThe bridge keeps running while Chrome is open. Stop it here or from its notification. Firmware writing is not included in this test.");help.setTextColor(Color.LTGRAY);help.setTextSize(17);root.addView(help);
        status=new TextView(this);status.setTextColor(Color.rgb(105,215,204));status.setPadding(0,20,0,20);root.addView(status);
        button(root,"Open in Chrome",this::launch);
        button(root,"Bluetooth settings",()->startActivity(new Intent(Settings.ACTION_BLUETOOTH_SETTINGS)));
        button(root,"Stop bridge",()->{opening=false;stopService(new Intent(this,BleBridgeService.class));showStatus();});
        if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)button(root,"Enable bridge notification",()->requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},11));
        ScrollView scroll=new ScrollView(this);scroll.addView(root);setContentView(scroll);
    }
    void button(LinearLayout root,String label,Runnable action){Button button=new Button(this);button.setText(label);button.setOnClickListener(v->action.run());root.addView(button,new LinearLayout.LayoutParams(-1,-2));}
    void showStatus(){BleBridgeService service=BleBridgeService.instance;status.setText(service!=null&&service.ready?"Bridge running · "+service.message:BleBridgeService.startupError!=null?BleBridgeService.startupError:"Bridge stopped. Select Open in Chrome to start.");}
    void launch(){
        Intent browser=new Intent(Intent.ACTION_VIEW,Uri.parse(LocalHttpServer.ORIGIN+"/")).setPackage("com.android.chrome");
        if(browser.resolveActivity(getPackageManager())==null){status.setText("Google Chrome is not installed. Install Chrome on this device, then try again.");return;}
        if(!permitted()){requestPermissions(new String[]{Manifest.permission.BLUETOOTH_CONNECT},10);return;}
        if(opening)return;opening=true;BleBridgeService.startupError=null;
        try{startForegroundService(new Intent(this,BleBridgeService.class));awaitService(0);}catch(Exception e){opening=false;status.setText("Could not start bridge: "+e.getMessage());}
    }
    void awaitService(int attempt){
        BleBridgeService service=BleBridgeService.instance;if(!opening)return;
        if(service!=null&&service.ready){opening=false;try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(service.launchUrl())).setPackage("com.android.chrome"));}catch(ActivityNotFoundException e){status.setText("Chrome is unavailable. Install or enable Chrome and try again.");}return;}
        if(BleBridgeService.startupError!=null||attempt>=40){opening=false;showStatus();return;}
        handler.postDelayed(()->awaitService(attempt+1),100);
    }
    @Override public void onRequestPermissionsResult(int request,String[] names,int[] results){super.onRequestPermissionsResult(request,names,results);if(request==10){if(permitted())launch();else status.setText("Nearby devices permission is required to read paired remotes. Select Open in Chrome to try again.");}}
    @Override protected void onResume(){super.onResume();handler.post(refresh);}
    @Override protected void onPause(){handler.removeCallbacks(refresh);super.onPause();}
    @Override protected void onDestroy(){opening=false;handler.removeCallbacksAndMessages(null);super.onDestroy();}
}
