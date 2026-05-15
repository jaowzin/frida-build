import "frida-il2cpp-bridge";

console.log("[+] Script IL2CPP bridge carregado");

Il2Cpp.perform(() => {
  console.log("[+] Il2Cpp inicializado");
  console.log("[+] Unity version: " + Il2Cpp.unityVersion);

  const assemblies = Il2Cpp.domain.assemblies;
  console.log("[+] Assemblies encontradas: " + assemblies.length);

  assemblies.slice(0, 10).forEach((assembly, index) => {
    const image = assembly.image;
    console.log(`[${index}] Assembly: ${image.name} | Classes: ${image.classes.length}`);
  });

  console.log("[+] Teste finalizado sem hookar/modificar nada");
});