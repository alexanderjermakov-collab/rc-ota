package com.scem.rcota;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.concurrent.atomic.AtomicInteger;

/** Exercises the production HTTP parser, listener, auth and shutdown using actual TCP sockets. */
public final class LocalHttpServerTest {
    static int checks;
    static void check(boolean condition,String message){checks++;if(!condition)throw new AssertionError(message);}
    static String request(String text)throws Exception{
        try(Socket socket=new Socket("127.0.0.1",LocalHttpServer.PORT)){socket.setSoTimeout(6000);socket.getOutputStream().write(text.getBytes(StandardCharsets.UTF_8));socket.shutdownOutput();ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] b=new byte[4096];int n;while((n=socket.getInputStream().read(b))!=-1)out.write(b,0,n);return new String(out.toByteArray(),StandardCharsets.UTF_8);}
    }
    static String get(String path,String headers)throws Exception{return request("GET "+path+" HTTP/1.1\r\nHost: "+LocalHttpServer.HOST+"\r\n"+headers+"\r\n");}
    static void status(int code,String response){check(response.startsWith("HTTP/1.1 "+code+" "),"Expected "+code+": "+response);}
    public static void main(String[] args)throws Exception{
        if(args.length>0&&args[0].equals("--serve")){preview();return;}
        AtomicInteger calls=new AtomicInteger();String auth="Authorization: Bearer unit-test-token\r\n";
        LocalHttpServer server=new LocalHttpServer("unit-test-token",(method,path,body)->{calls.incrementAndGet();return LocalHttpServer.Response.json(200,"{\"ok\":true,\"bytes\":"+body.getBytes(StandardCharsets.UTF_8).length+"}");});server.start();
        try{
            java.lang.reflect.Field field=LocalHttpServer.class.getDeclaredField("server");field.setAccessible(true);check(((ServerSocket)field.get(server)).getInetAddress().getHostAddress().equals("127.0.0.1"),"Only loopback is bound");
            status(200,get("/index.html",""));
            status(401,get("/api/state",""));status(401,get("/api/state","Authorization: Bearer wrong\r\n"));
            check(calls.get()==1,"Unauthorized requests never reach BLE routes");
            String valid=get("/api/state",auth);status(200,valid);check(valid.contains("Cache-Control: no-store"),"State not cached");check(valid.contains("frame-ancestors 'none'"),"No iframe access");check(!valid.contains("Access-Control-Allow-Origin"),"No permissive CORS");
            status(200,get("/api/state",auth+"Origin: "+LocalHttpServer.ORIGIN+"\r\n"));
            status(403,get("/api/state",auth+"Origin: https://attacker.example\r\n"));status(403,get("/api/state",auth+"Origin: null\r\n"));
            status(403,get("/api/state",auth+"Sec-Fetch-Site: cross-site\r\n"));
            status(403,request("GET /api/state HTTP/1.1\r\nHost: attacker.example:18764\r\n"+auth+"\r\n"));
            status(403,request("GET /api/state HTTP/1.1\r\n"+auth+"\r\n"));
            status(400,get("/api/state",auth+"Host: 127.0.0.1:18764\r\n"));
            status(400,get("/api/state",auth+"Authorization: Bearer unit-test-token\r\n"));
            status(400,get("/api/state",auth+"Transfer-Encoding: chunked\r\n"));
            status(400,get("/api/state",auth+"Content-Length: -1\r\n"));
            status(400,get("/api/state",auth+"Content-Length: 1\r\n"));
            status(405,request("OPTIONS /api/state HTTP/1.1\r\nHost: "+LocalHttpServer.HOST+"\r\n"+auth+"\r\n"));
            String post="POST /api/connect HTTP/1.1\r\nHost: "+LocalHttpServer.HOST+"\r\n"+auth;
            status(415,request(post+"Content-Type: text/plain\r\nContent-Length: 2\r\n\r\n{}"));
            status(413,request(post+"Content-Type: application/json\r\nContent-Length: 4097\r\n\r\n"));
            status(400,request(post+"Content-Type: application/json\r\nContent-Length: 10\r\n\r\n{}"));
            String json="{\"model\":\"é\"}",response=request(post+"Content-Type: application/json\r\nContent-Length: "+json.getBytes(StandardCharsets.UTF_8).length+"\r\n\r\n"+json);status(200,response);check(response.contains("\"bytes\":"+json.getBytes(StandardCharsets.UTF_8).length),"UTF-8 body preserved");
            boolean occupied=false;try{new LocalHttpServer("other",(m,p,b)->LocalHttpServer.Response.json(200,"{}"));}catch(BindException e){occupied=true;}check(occupied,"Occupied port reported");
        }finally{server.close();}
        boolean stopped=false;try{new Socket("127.0.0.1",LocalHttpServer.PORT).close();}catch(ConnectException e){stopped=true;}check(stopped,"Listener closed on shutdown");
        try(LocalHttpServer restarted=new LocalHttpServer("new-session-token",(m,p,b)->LocalHttpServer.Response.json(200,"{}"))){restarted.start();status(401,get("/api/state",auth));status(200,get("/api/state","Authorization: Bearer new-session-token\r\n"));}
        System.out.println(checks+" loopback HTTP checks passed");
    }
    static void preview()throws Exception{
        Path docs=Paths.get("docs");
        String state="{\"version\":\"0.7.0\",\"transport\":\"Local Android BLE Bridge\",\"serviceRunning\":true,\"connectPermission\":true,\"bluetoothAvailable\":true,\"bluetoothEnabled\":true,\"devices\":[{\"name\":\"SHARP SOLAR RCU\",\"address\":\"AA:BB:CC:DD:EE:FF\"}],\"selectedAddress\":\"AA:BB:CC:DD:EE:FF\",\"bondState\":\"bonded\",\"stage\":\"verified\",\"gattConnected\":true,\"verified\":true,\"message\":\"Test harness · simulated remote data for UI review\",\"metadata\":{\"name\":\"SHARP SOLAR RCU\",\"model\":\"TEST-MODEL\",\"firmware\":\"V0.0.11\",\"level\":74,\"address\":\"AA:BB:CC:DD:EE:FF\"},\"readAt\":1792969000000,\"dataStale\":false,\"services\":[],\"ota\":{},\"trace\":[]}";
        LocalHttpServer server=new LocalHttpServer("preview-test-token",(method,path,body)->{
            if(path.startsWith("/api/"))return LocalHttpServer.Response.json(200,state);
            String file,mime;switch(path){case "/":case "/index.html":file="local/index.html";mime="text/html";break;case "/local.js":file="local/app.js";mime="text/javascript";break;case "/local.css":file="local/style.css";mime="text/css";break;case "/ota.js":file="ota.js";mime="text/javascript";break;default:return LocalHttpServer.error(404,"Not found");}
            return new LocalHttpServer.Response(200,mime+"; charset=utf-8",Files.readAllBytes(docs.resolve(file)));
        });server.start();System.out.println("PREVIEW_READY (simulated data)");new java.util.concurrent.CountDownLatch(1).await();
    }
}
