package com.scem.rcota;
import org.json.JSONObject;
import java.net.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
/** Read-only metadata and HEAD requests to the manufacturer's fixed OTA host. */
public final class OtaCatalog {
 static final String HOST="firmware.umc-poland.com";
 static URL checked(String value) throws Exception {URL u=new URL(value);if(!HOST.equalsIgnoreCase(u.getHost())||!(u.getProtocol().equals("https")||u.getProtocol().equals("http"))||u.getUserInfo()!=null||u.getPort()!=-1)throw new IOException("Unexpected OTA server URL.");return u;}
 static HttpURLConnection open(String value,String method)throws Exception {String next=value;for(int i=0;i<4;i++){URL u=checked(next);HttpURLConnection c=(HttpURLConnection)u.openConnection();c.setConnectTimeout(12000);c.setReadTimeout(12000);c.setInstanceFollowRedirects(false);c.setRequestMethod(method);int code=c.getResponseCode();if(code>=300&&code<400){String loc=c.getHeaderField("Location");c.disconnect();if(loc==null)throw new IOException("Invalid OTA redirect.");URL dest=new URL(u,loc);if(u.getProtocol().equals("https")&&dest.getProtocol().equals("http"))throw new IOException("OTA server attempted an HTTPS downgrade.");checked(dest.toString());next=dest.toString();continue;}return c;}throw new IOException("Too many OTA redirects.");}
 static String text(String url)throws Exception {HttpURLConnection c=open(url,"GET");try{int status=c.getResponseCode();if(status!=200)throw new IOException("OTA metadata returned HTTP "+status);try(InputStream in=c.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] b=new byte[4096];int n,total=0;while((n=in.read(b))!=-1){total+=n;if(total>65536)throw new IOException("OTA metadata response too large.");out.write(b,0,n);}return new String(out.toByteArray(),StandardCharsets.UTF_8);}}finally{c.disconnect();}}
 public static JSONObject check(String model)throws Exception {
 if(model==null||model.isEmpty()||model.length()>80||model.contains("/")||model.contains("\\")||model.matches(".*[\\x00-\\x1f].*"))throw new IOException("Exact remote model is required.");
 String base="http://"+HOST+"/"+URLEncoder.encode(model,"UTF-8").replace("+","%20")+"/";
 String[] urls=text(base).trim().split("\\s+");if(urls.length!=2||!checked(urls[0]).getPath().toLowerCase(Locale.ROOT).endsWith(".bin")||!checked(urls[1]).getPath().toLowerCase(Locale.ROOT).endsWith(".txt"))throw new IOException("Invalid manufacturer OTA listing.");
 JSONObject info=new JSONObject();Set<String> allowed=new HashSet<>(Arrays.asList("name","version","md5sum","scenario","mac"));
 for(String line:text(urls[1]).trim().split("\\r?\\n")){int p=line.indexOf(':');if(p<1)throw new IOException("Invalid OTA metadata line.");String key=line.substring(0,p).trim(),v=line.substring(p+1).trim();if(!allowed.contains(key)||info.has(key))throw new IOException("Unexpected OTA metadata field.");info.put(key,v);}
 if(info.optString("name").isEmpty()||info.optString("version").isEmpty()||!info.optString("md5sum").matches("(?i)[0-9a-f]{32}"))throw new IOException("Incomplete OTA version metadata.");
 info.put("model",model);info.put("firmwareUrl",urls[0]);info.put("metadataUrl",urls[1]);
 try{HttpURLConnection bin=open(urls[0],"HEAD");try{int code=bin.getResponseCode();String type=bin.getContentType();long size=bin.getContentLengthLong();boolean html=type!=null&&type.toLowerCase(Locale.ROOT).contains("text/html");if(code>=200&&code<300&&!html&&size!=0)info.put("binaryAvailable",true);else if(code==404||code==410||size==0)info.put("binaryAvailable",false);else info.put("binaryAvailable",JSONObject.NULL);info.put("binaryStatus","HTTP "+code+"; "+(html?"HTML response, not confirmed as BIN":size>0?size+" bytes":"file size not reported"));}finally{bin.disconnect();}}catch(Exception e){info.put("binaryAvailable",JSONObject.NULL);info.put("binaryStatus","File availability could not be checked: "+e.getMessage());}
 return info;
 }
}
