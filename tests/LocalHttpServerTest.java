package com.scem.rcota;
import java.net.*;import java.io.*;import java.nio.charset.StandardCharsets;import java.util.*;
public class LocalHttpServerTest {
 static int checks;
 static void check(boolean b){checks++;if(!b)throw new AssertionError("Check "+checks);}
 static String request(String method,String path,String host,String auth,String origin)throws Exception{try(Socket s=new Socket("127.0.0.1",LocalHttpServer.PORT)){s.setSoTimeout(2000);String data=method+" "+path+" HTTP/1.1\r\nHost: "+host+"\r\n"+(auth==null?"":"Authorization: "+auth+"\r\n")+(origin==null?"":"Origin: "+origin+"\r\n")+"Content-Length: 0\r\n\r\n";s.getOutputStream().write(data.getBytes(StandardCharsets.US_ASCII));ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] b=new byte[1024];int n;while((n=s.getInputStream().read(b))!=-1)out.write(b,0,n);return out.toString("UTF-8");}}
 public static void main(String[]args)throws Exception{
  try(LocalHttpServer server=new LocalHttpServer("test-token",(method,path,body)->LocalHttpServer.Reply.json("{\"ok\":true}"))){server.start();check(server.server.getInetAddress().isLoopbackAddress());
   check(request("GET","/",LocalHttpServer.HOST,null,null).startsWith("HTTP/1.1 200"));
   check(request("GET","/api/state",LocalHttpServer.HOST,null,null).startsWith("HTTP/1.1 403"));
   check(request("GET","/api/state",LocalHttpServer.HOST,"Bearer wrong",null).startsWith("HTTP/1.1 403"));
   String response=request("GET","/api/state",LocalHttpServer.HOST,"Bearer test-token",LocalHttpServer.ORIGIN);check(response.startsWith("HTTP/1.1 200"));check(response.endsWith("{\"ok\":true}"));check(response.contains("Cache-Control: no-store"));check(!response.contains("Access-Control-Allow-Origin"));check(response.contains("frame-ancestors 'none'"));
   check(request("GET","/api/state","evil.example","Bearer test-token",null).startsWith("HTTP/1.1 403"));
   check(request("GET","/api/state",LocalHttpServer.HOST,"Bearer test-token","https://evil.example").startsWith("HTTP/1.1 403"));
   check(request("POST","/api/disconnect",LocalHttpServer.HOST,"Bearer test-token",LocalHttpServer.ORIGIN).startsWith("HTTP/1.1 200"));
   check(request("OPTIONS","/api/state",LocalHttpServer.HOST,"Bearer test-token",null).startsWith("HTTP/1.1 403"));
   check(request("GET","/app.js",LocalHttpServer.HOST,null,"https://evil.example").startsWith("HTTP/1.1 403"));
  }
  System.out.println(checks+" HTTP transport checks passed");
 }
}
