📦
186 /agent.js
✄
// agent.ts
Java.perform(() => {
  console.log("[+] Script Frida iniciado");
  const StringClass = Java.use("java.lang.String");
  console.log("[+] Classe carregada:", StringClass);
});
