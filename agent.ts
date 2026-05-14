declare const Java: any;

Java.perform(() => {
  console.log("[+] Script Frida iniciado");

  const StringClass = Java.use("java.lang.String");

  console.log("[+] Classe carregada:", StringClass);
});
