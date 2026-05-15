// @ts-nocheck
import "frida-il2cpp-bridge";

console.log("[+] Teste iniciado");

setTimeout(() => {
  try {
    console.log("[+] Java available: " + Java.available);

    Java.perform(() => {
      console.log("[+] Java.perform funcionou");
    });
  } catch (e) {
    console.log("[-] Java.perform falhou: " + e);
  }
}, 10000);

Il2Cpp.perform(() => {
  console.log("[+] Il2Cpp OK");
  console.log("[+] Unity: " + Il2Cpp.unityVersion);
});