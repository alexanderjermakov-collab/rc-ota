package com.scem.rcota;
import java.util.Locale;
/** Selection of supported bonded remotes; no Bluetooth or UI dependencies. */
final class RemotePolicy {
 static boolean supported(String name){if(name==null)return false;String n=name.trim().replaceAll("\\s+"," ").toUpperCase(Locale.ROOT);return n.equals("SHARP RCU")||n.equals("SHARP SOLAR RCU");}
 static int select(String[] names,String[] addresses,String saved){int only=-1,count=0;for(int i=0;i<names.length;i++){if(!supported(names[i]))continue;if(saved!=null&&saved.equals(addresses[i]))return i;only=i;count++;}return count==1?only:-1;}
 static boolean canRestore(boolean ready,boolean resumed,boolean attempted,boolean permission,boolean enabled,boolean active){return ready&&resumed&&!attempted&&permission&&enabled&&!active;}
}
