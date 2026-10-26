package com.scem.rcota;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;
/** Loopback-only HTTP transport. No Bluetooth, filesystem paths or arbitrary proxy routes. */
final class LocalHttpServer implements AutoCloseable {
 static final int PORT=18764;
 static final String HOST="127.0.0.1:"+PORT, ORIGIN="http://"+HOST;
 interface Routes { Reply handle(String method,String path,byte[] body) throws Exception; }
 static final class Reply { final int status;final String mime;final byte[] body;
  Reply(int s,String m,byte[] b){status=s;mime=m;body=b;}
  static Reply json(String s){return new Reply(200,"application/json",s.getBytes(StandardCharsets.UTF_8));}
 }
 final ServerSocket server;final String token;final Routes routes;
 final ThreadPoolExecutor workers=new ThreadPoolExecutor(2,4,30,TimeUnit.SECONDS,new ArrayBlockingQueue<>(12));
 volatile boolean closed;
 LocalHttpServer(String token,Routes routes)throws IOException{this.token=token;this.routes=routes;server=new ServerSocket();server.setReuseAddress(true);server.bind(new InetSocketAddress(InetAddress.getByName("127.0.0.1"),PORT),8);}
 void start(){Thread t=new Thread(()->{while(!closed)try{Socket socket=server.accept();try{workers.execute(()->serve(socket));}catch(RejectedExecutionException e){socket.close();}}catch(IOException e){if(!closed)close();}},"RCOTA-http");t.setDaemon(true);t.start();}
 static boolean allowed(String method,Map<String,String> headers,String path,String token){
  if(!HOST.equals(headers.get("host")))return false;
  String origin=headers.get("origin");if(origin!=null&&!ORIGIN.equals(origin))return false;
  if(!method.equals("GET")&&!method.equals("POST"))return false;
  if(path.startsWith("/api/")){String auth=headers.get("authorization");if(auth==null||!MessageDigest.isEqual(("Bearer "+token).getBytes(StandardCharsets.UTF_8),auth.getBytes(StandardCharsets.UTF_8)))return false;}
  return true;
 }
 static String line(InputStream in,int limit)throws IOException{ByteArrayOutputStream b=new ByteArrayOutputStream();int c;while((c=in.read())!=-1){if(c=='\n')return b.toString("US-ASCII").replace("\r","");if(b.size()>=limit)throw new IOException("Header too large");b.write(c);}throw new EOFException();}
 void serve(Socket socket){try(Socket s=socket){s.setSoTimeout(5000);InputStream in=s.getInputStream();String[] first=line(in,2048).split(" ");if(first.length!=3)throw new IOException("Invalid request");Map<String,String> headers=new HashMap<>();int size=0;while(true){String l=line(in,4096);if(l.isEmpty())break;size+=l.length();if(size>16384)throw new IOException("Headers too large");int colon=l.indexOf(':');if(colon<1)throw new IOException("Invalid header");String key=l.substring(0,colon).toLowerCase(Locale.ROOT);if(headers.put(key,l.substring(colon+1).trim())!=null)throw new IOException("Duplicate header");}
   String method=first[0],path=first[1];Reply reply;
   if(!allowed(method,headers,path,token))reply=new Reply(403,"text/plain","Forbidden".getBytes(StandardCharsets.UTF_8));
   else if(headers.containsKey("transfer-encoding"))reply=new Reply(400,"text/plain",new byte[0]);
   else{int length=Integer.parseInt(headers.getOrDefault("content-length","0"));if(length<0||length>16384)throw new IOException("Body too large");byte[] body=new byte[length];int pos=0,n;while(pos<length&&(n=in.read(body,pos,length-pos))!=-1)pos+=n;if(pos!=length)throw new EOFException();try{reply=routes.handle(method,path,body);}catch(Exception e){reply=new Reply(500,"application/json","{\"error\":\"Bridge request failed\"}".getBytes(StandardCharsets.UTF_8));}}
   byte[] head=("HTTP/1.1 "+reply.status+" RCOTA\r\nContent-Type: "+reply.mime+"; charset=utf-8\r\nContent-Length: "+reply.body.length+"\r\nConnection: close\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nReferrer-Policy: no-referrer\r\nContent-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' https://firmware.umc-poland.com; object-src 'none'; frame-ancestors 'none'; base-uri 'none'\r\n\r\n").getBytes(StandardCharsets.US_ASCII);s.getOutputStream().write(head);s.getOutputStream().write(reply.body);s.getOutputStream().flush();
  }catch(Exception ignored){}
 }
 @Override public void close(){closed=true;try{server.close();}catch(IOException ignored){}workers.shutdownNow();}
}
