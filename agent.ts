// @ts-nocheck
import "frida-il2cpp-bridge";

const TARGET_ASSEMBLY = "Assembly-CSharp";

// Vazio = todas as classes do Assembly-CSharp
// Exemplo: "Player", "Game", "Weapon"
const CLASS_FILTER = "";

// true = mostra argumentos, pode pesar bastante
const LOG_ARGS = false;

// Limite de logs total por segundo
const MAX_LOGS_PER_SECOND = 80;

// Limite de logs por método
// 0 = infinito
const MAX_LOGS_PER_METHOD = 10;

// Limite de métodos para instalar trace
// 0 = sem limite
const MAX_METHODS_TO_TRACE = 0;

// true = inclui get_/set_
const TRACE_PROPERTIES = true;

// true = inclui construtores .ctor
const TRACE_CONSTRUCTORS = true;

// true = inclui métodos Update/LateUpdate/FixedUpdate
// cuidado, esses floodam bastante
const TRACE_UPDATE_METHODS = true;

let logsThisSecond = 0;
const methodLogCount = {};

setInterval(function () {
  logsThisSecond = 0;
}, 1000);

console.log("[+] Trace TODOS metodos Assembly-CSharp iniciado");

function canLog(): boolean {
  if (logsThisSecond >= MAX_LOGS_PER_SECOND) {
    return false;
  }

  logsThisSecond++;
  return true;
}

function safeStr(v: any): string {
  try {
    if (v === null) return "null";
    if (v === undefined) return "undefined";
    return String(v);
  } catch (e) {
    return "<erro>";
  }
}

function classFullName(klass: any): string {
  try {
    if (klass.namespace && String(klass.namespace).length > 0) {
      return klass.namespace + "." + klass.name;
    }

    return klass.name;
  } catch (e) {
    return "<unknown>";
  }
}

function matchClass(name: string): boolean {
  if (!CLASS_FILTER || CLASS_FILTER.length === 0) return true;
  return name.toLowerCase().includes(CLASS_FILTER.toLowerCase());
}

function shouldTraceMethod(method: any): boolean {
  try {
    const name = String(method.name);

    if (!TRACE_PROPERTIES) {
      if (name.startsWith("get_")) return false;
      if (name.startsWith("set_")) return false;
    }

    if (!TRACE_CONSTRUCTORS) {
      if (name === ".ctor") return false;
      if (name === ".cctor") return false;
    }

    if (!TRACE_UPDATE_METHODS) {
      if (name === "Update") return false;
      if (name === "LateUpdate") return false;
      if (name === "FixedUpdate") return false;
    }

    try {
      if (method.isExternal) return false;
    } catch (e) {}

    return true;
  } catch (e) {
    return false;
  }
}

function getMethodSignature(method: any): string {
  try {
    let ret = "void";

    try {
      ret = method.returnType.name;
    } catch (e) {}

    const params = [];

    try {
      for (const p of method.parameters) {
        let pType = "unknown";
        let pName = "param";

        try {
          pType = p.type.name;
        } catch (e) {}

        try {
          pName = p.name || "param";
        } catch (e) {}

        params.push(pType + " " + pName);
      }
    } catch (e) {}

    return ret + " " + method.name + "(" + params.join(", ") + ")";
  } catch (e) {
    return String(method.name);
  }
}

function installTrace(method: any, klassName: string): boolean {
  try {
    const methodName = String(method.name);
    const signature = getMethodSignature(method);
    const traceId = klassName + "." + methodName;

    methodLogCount[traceId] = 0;

    method.implementation = function (...args: any[]) {
      try {
        if (MAX_LOGS_PER_METHOD > 0) {
          if (methodLogCount[traceId] >= MAX_LOGS_PER_METHOD) {
            return method.invoke(this, ...args);
          }

          methodLogCount[traceId]++;
        }

        if (canLog()) {
          console.log("[TRACE] " + klassName + "." + signature);

          if (LOG_ARGS && args && args.length > 0) {
            for (let i = 0; i < args.length; i++) {
              console.log("  arg" + i + ": " + safeStr(args[i]));
            }
          }
        }
      } catch (e) {}

      return method.invoke(this, ...args);
    };

    console.log("[+] Trace: " + klassName + "." + signature);
    return true;
  } catch (e) {
    try {
      console.log("[-] Falhou: " + klassName + "." + method.name);
      console.log(String(e));
    } catch (_) {}

    return false;
  }
}

function main() {
  Il2Cpp.perform(function () {
    console.log("[+] Unity: " + Il2Cpp.unityVersion);

    const asm = Il2Cpp.domain.assembly(TARGET_ASSEMBLY);

    if (!asm) {
      console.log("[-] Assembly nao encontrada: " + TARGET_ASSEMBLY);
      console.log("[*] Assemblies disponiveis:");

      for (const a of Il2Cpp.domain.assemblies) {
        try {
          console.log(" - " + a.image.name);
        } catch (e) {}
      }

      return;
    }

    console.log("[+] Assembly: " + asm.image.name);
    console.log("[+] Classes: " + asm.image.classes.length);

    let classCount = 0;
    let methodCount = 0;
    let traceCount = 0;
    let failCount = 0;

    for (const klass of asm.image.classes) {
      let klassName = "";

      try {
        klassName = classFullName(klass);
      } catch (e) {
        continue;
      }

      if (!matchClass(klassName)) {
        continue;
      }

      classCount++;

      try {
        for (const method of klass.methods) {
          methodCount++;

          if (!shouldTraceMethod(method)) {
            continue;
          }

          if (MAX_METHODS_TO_TRACE > 0 && traceCount >= MAX_METHODS_TO_TRACE) {
            console.log("[!] Limite de métodos atingido: " + MAX_METHODS_TO_TRACE);
            console.log("[+] Classes analisadas: " + classCount);
            console.log("[+] Métodos encontrados: " + methodCount);
            console.log("[+] Traces instalados: " + traceCount);
            console.log("[+] Falhas: " + failCount);
            return;
          }

          const ok = installTrace(method, klassName);

          if (ok) {
            traceCount++;
          } else {
            failCount++;
          }
        }
      } catch (e) {}
    }

    console.log("");
    console.log("========== RESULTADO ==========");
    console.log("[+] Classes analisadas: " + classCount);
    console.log("[+] Métodos encontrados: " + methodCount);
    console.log("[+] Traces instalados: " + traceCount);
    console.log("[+] Falhas: " + failCount);
    console.log("[+] Trace ativo.");
  });
}

setTimeout(main, 5000);