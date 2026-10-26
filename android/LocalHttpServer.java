package com.scem.rcota;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;

/** HTTP/1.1 loopback server; independent of Android for real socket tests on the JVM. */
final class LocalHttpServer implements Closeable {
    static final int PORT=18764;
    static final String HOST="127.0.0.1:"+PORT, ORIGIN="http://"+HOST;
    interface Routes { Response handle(String method,String path,String body)throws Exception; }
    static final class Response {
        final int status; final String mime; final byte[] body;
        Response(int status,String mime,byte[] body){this.status=status;this.mime=mime;this.body=body;}
        static Response json(int code,String body){return new Response(code,"application/json; charset=utf-8",body.getBytes(StandardCharsets.UTF_8));}
    }
    private final String token;
    private final Routes routes;
    private final ServerSocket server=new ServerSocket();
    private final Set<Socket> sockets=Collections.synchronizedSet(new HashSet<Socket>());
    private final ThreadPoolExecutor workers=new ThreadPoolExecutor(2,4,30,TimeUnit.SECONDS,new ArrayBlockingQueue<Runnable>(16));
    private volatile boolean closed;
    LocalHttpServer(String token,Routes routes)throws IOException{
        this.token=token;this.routes=routes;
        try{server.setReuseAddress(true);server.bind(new InetSocketAddress(InetAddress.getByName("127.0.0.1"),PORT),16);}
        catch(IOException e){server.close();workers.shutdownNow();throw e;}
    }
    void start(){
        Thread accept=new Thread(()->{
            while(!closed)try{
                Socket socket=server.accept();socket.setSoTimeout(4000);sockets.add(socket);
                try{workers.execute(()->serve(socket));}catch(RejectedExecutionException e){sockets.remove(socket);socket.close();}
            }catch(IOException e){if(!closed)close();}
        },"rcota-http");accept.setDaemon(true);accept.start();
    }
    private static String line(InputStream in,int limit)throws IOException{
        ByteArrayOutputStream out=new ByteArrayOutputStream();
        for(int n=0;n<limit;n++){
            int b=in.read();if(b<0)throw new EOFException();
            if(b=='\n'){byte[] bytes=out.toByteArray();if(bytes.length==0||bytes[bytes.length-1]!='\r')throw new IOException("Invalid line");return new String(bytes,0,bytes.length-1,StandardCharsets.US_ASCII);}
            if(b>127||b==0)throw new IOException("Invalid header");out.write(b);
        }throw new IOException("Header too long");
    }
    private void serve(Socket socket){
        try(Socket client=socket){
            Response response;
            try{response=request(client.getInputStream());}
            catch(SocketTimeoutException e){response=error(408,"Request timed out");}
            catch(IOException|IllegalArgumentException e){response=error(400,"Invalid HTTP request");}
            catch(Exception e){response=error(503,"Bridge is busy. Retry shortly.");}
            OutputStream out=client.getOutputStream();
            String header="HTTP/1.1 "+response.status+" "+reason(response.status)+"\r\nContent-Type: "+response.mime+"\r\nContent-Length: "+response.body.length
                +"\r\nConnection: close\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nReferrer-Policy: no-referrer\r\nX-Frame-Options: DENY"
                +"\r\nContent-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'\r\n\r\n";
            out.write(header.getBytes(StandardCharsets.US_ASCII));out.write(response.body);out.flush();
        }catch(IOException ignored){}finally{sockets.remove(socket);}
    }
    private Response request(InputStream in)throws Exception{
        String[] first=line(in,4096).split(" ",-1);
        if(first.length!=3||!"HTTP/1.1".equals(first[2])||!first[1].startsWith("/")||first[1].contains("#"))return error(400,"Invalid request target");
        Map<String,String> headers=new HashMap<>();int total=0;
        for(int count=0;;count++){
            String entry=line(in,4096);total+=entry.length();if(total>8192||count>40)return error(431,"Headers too large");if(entry.isEmpty())break;
            int colon=entry.indexOf(':');if(colon<1||!entry.substring(0,colon).matches("[A-Za-z0-9-]+"))return error(400,"Invalid header");
            String name=entry.substring(0,colon).toLowerCase(Locale.ROOT);if(headers.put(name,entry.substring(colon+1).trim())!=null)return error(400,"Duplicate header");
        }
        if(!HOST.equals(headers.get("host")))return error(403,"Invalid local host");
        String origin=headers.get("origin");if(origin!=null&&!ORIGIN.equals(origin))return error(403,"Origin is not allowed");
        if("cross-site".equals(headers.get("sec-fetch-site")))return error(403,"Cross-site access is not allowed");
        if(headers.containsKey("transfer-encoding"))return error(400,"Chunked requests are not supported");
        String path=first[1].split("\\?",2)[0];boolean api=path.startsWith("/api/");
        if(api&&!MessageDigest.isEqual(("Bearer "+token).getBytes(StandardCharsets.UTF_8),headers.getOrDefault("authorization","").getBytes(StandardCharsets.UTF_8)))return error(401,"Open RC OTA and select Open in Chrome to authorize this tab.");
        if(!first[0].equals("GET")&&!first[0].equals("POST"))return error(405,"Method not allowed");
        int length=0;if(headers.containsKey("content-length")){String value=headers.get("content-length");if(!value.matches("[0-9]{1,5}"))return error(400,"Invalid content length");length=Integer.parseInt(value);}
        if(length>4096)return error(413,"Request body too large");
        if(first[0].equals("GET")&&length!=0)return error(400,"GET body is not supported");
        if(first[0].equals("POST")&&(!api||!"application/json".equals(headers.getOrDefault("content-type","").split(";",2)[0].trim())))return error(415,"JSON request required");
        byte[] body=new byte[length];int offset=0;while(offset<length){int n=in.read(body,offset,length-offset);if(n<0)throw new EOFException();offset+=n;}
        return routes.handle(first[0],path,new String(body,StandardCharsets.UTF_8));
    }
    static Response error(int code,String message){return Response.json(code,"{\"error\":\""+message+"\"}");}
    private static String reason(int status){switch(status){case 200:return "OK";case 202:return "Accepted";case 400:return "Bad Request";case 401:return "Unauthorized";case 403:return "Forbidden";case 404:return "Not Found";case 405:return "Method Not Allowed";case 408:return "Request Timeout";case 413:return "Payload Too Large";case 415:return "Unsupported Media Type";case 431:return "Request Header Fields Too Large";default:return "Service Unavailable";}}
    @Override public void close(){closed=true;try{server.close();}catch(IOException ignored){}synchronized(sockets){for(Socket socket:sockets)try{socket.close();}catch(IOException ignored){}sockets.clear();}workers.shutdownNow();}
}
