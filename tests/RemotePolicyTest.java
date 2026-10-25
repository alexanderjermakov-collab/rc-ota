package com.scem.rcota;
public final class RemotePolicyTest {
 static void check(boolean b){if(!b)throw new AssertionError();}
 public static void main(String[] args){
 check(RemotePolicy.supported("SHARP RCU"));check(RemotePolicy.supported("SHARP SOLAR RCU"));check(RemotePolicy.supported(" sharp  solar rcu "));
 check(!RemotePolicy.supported(null));check(!RemotePolicy.supported("SHARP TV"));check(!RemotePolicy.supported("Headphones"));
 String[] names={"Headphones","SHARP RCU","SHARP SOLAR RCU"},addresses={"a","b","c"};
 check(RemotePolicy.select(names,addresses,null)==-1);check(RemotePolicy.select(names,addresses,"b")==1);check(RemotePolicy.select(names,addresses,"c")==2);check(RemotePolicy.select(names,addresses,"a")==-1);
 check(RemotePolicy.select(new String[]{"SHARP SOLAR RCU"},new String[]{"c"},"stale")==0);
 check(RemotePolicy.select(new String[]{"SHARP RCU"},new String[]{"b"},null)==0);check(RemotePolicy.select(new String[]{},new String[]{},null)==-1);
 check(!RemotePolicy.canRestore(false,true,false,true,true,false)); // onResume before page handshake
 check(RemotePolicy.canRestore(true,true,false,true,true,false)); // hello after page start
 check(!RemotePolicy.canRestore(true,true,true,true,true,false)); // duplicate hello
 check(!RemotePolicy.canRestore(true,false,false,true,true,false)); // paused activity
 check(!RemotePolicy.canRestore(true,true,false,false,true,false)); // missing connect permission
 check(!RemotePolicy.canRestore(true,true,false,true,false,false)); // radio off
 check(!RemotePolicy.canRestore(true,true,false,true,true,true)); // pairing/GATT in progress
 System.out.println("20 native policy checks passed");
 }
}
