import "frida-il2cpp-bridge";

const INF_MONEY = 999999999;
const INF_HP = 999999;

function log(msg: string) {
    console.log(`[CTF] ${msg}`);
}

function image() {
    return Il2Cpp.domain.assembly("Assembly-CSharp").image;
}

function klass(img: Il2Cpp.Image, ...names: string[]): Il2Cpp.Class {
    for (const name of names) {
        try {
            return img.class(name);
        } catch (_) {}
    }

    throw new Error(`Classe não encontrada: ${names.join(" | ")}`);
}

function method(c: Il2Cpp.Class, name: string, argc?: number): Il2Cpp.Method {
    const found = c.methods.find(m => {
        if (m.name !== name) return false;
        if (argc === undefined) return true;
        return m.parameters.length === argc;
    });

    if (!found) {
        throw new Error(`Método não encontrado: ${c.name}.${name}/${argc ?? "*"}`);
    }

    return found;
}

function asObj(self: any): Il2Cpp.Object {
    return self as unknown as Il2Cpp.Object;
}

function setField(obj: Il2Cpp.Object, name: string, value: any): boolean {
    try {
        (obj.field(name) as any).value = value;
        return true;
    } catch (_) {
        return false;
    }
}

function getField(obj: Il2Cpp.Object, name: string): any {
    try {
        return (obj.field(name) as any).value;
    } catch (_) {
        return null;
    }
}

function invokeOriginal(m: Il2Cpp.Method, self: any, ...args: any[]): any {
    return (m as any).invoke(self, ...args);
}

function invokeStatic(m: Il2Cpp.Method, ...args: any[]): any {
    return (m as any).invoke(...args);
}

function listCount(listObj: Il2Cpp.Object): number {
    try {
        return (listObj.method("get_Count") as any).invoke() as number;
    } catch (_) {
        try {
            return (listObj.field("_size") as any).value as number;
        } catch (_) {
            return 0;
        }
    }
}

function listGet(listObj: Il2Cpp.Object, index: number): Il2Cpp.Object | null {
    try {
        return (listObj.method("get_Item") as any).invoke(index) as Il2Cpp.Object;
    } catch (_) {
        try {
            const items = (listObj.field("_items") as any).value;
            return items.get(index) as Il2Cpp.Object;
        } catch (_) {
            return null;
        }
    }
}

function patchFPSPlayer(player: Il2Cpp.Object) {
    setField(player, "isGodMode", true);
    setField(player, "invulnerable", true);
    setField(player, "regenerateHealth", true);

    setField(player, "maximumHitPoints", INF_HP);
    setField(player, "hitPoints", INF_HP);

    setField(player, "MaxshieldsPoints", INF_HP);
    setField(player, "ShieldsPoints", INF_HP);

    setField(player, "usePlayerHunger", false);
    setField(player, "usePlayerThirst", false);
    setField(player, "hungerPoints", 0);
    setField(player, "thirstPoints", 0);
}

function patchHealthScriptIfPlayer(obj: Il2Cpp.Object) {
    const aiBase = getField(obj, "myAIBaseScript");

    if (aiBase && !aiBase.isNull()) {
        return;
    }

    setField(obj, "isGodMode", true);
    setField(obj, "health", INF_HP);
    setField(obj, "maxHealth", INF_HP);
    setField(obj, "shields", INF_HP);
    setField(obj, "maxShields", INF_HP);
}

function patchLivePlayers(img: Il2Cpp.Image) {
    try {
        const FPSPlayer = klass(img, "FPSPlayer");

        for (const obj of Il2Cpp.gc.choose(FPSPlayer)) {
            patchFPSPlayer(obj);
        }
    } catch (_) {}

    try {
        const HealthScript = klass(img, "TacticalAI.HealthScript", "HealthScript");

        for (const obj of Il2Cpp.gc.choose(HealthScript)) {
            patchHealthScriptIfPlayer(obj);
        }
    } catch (_) {}
}

function giveMoney(img: Il2Cpp.Image) {
    try {
        const ItemDataManager = klass(img, "DataCenter.ItemDataManager", "ItemDataManager");
        const setCurrency = method(ItemDataManager, "SetCurrency", 2);

        invokeStatic(setCurrency, 1, INF_MONEY);   // GOLD
        invokeStatic(setCurrency, 4, INF_MONEY);   // TICKET
        invokeStatic(setCurrency, 5, INF_MONEY);   // WEAPONFRAGMENTS
        invokeStatic(setCurrency, 102, INF_MONEY); // SKIN
    } catch (_) {}
}

function unlockSkins(img: Il2Cpp.Image) {
    try {
        const WeaponSkinManager = klass(img, "WeaponSkinManager");
        const instance = (WeaponSkinManager.field("Instance") as any).value as Il2Cpp.Object;

        if (!instance || instance.isNull()) {
            return;
        }

        const skins = (instance.field("weaponSkins") as any).value as Il2Cpp.Object;
        const count = listCount(skins);

        for (let i = 0; i < count; i++) {
            const skin = listGet(skins, i);

            if (!skin || skin.isNull()) {
                continue;
            }

            setField(skin, "owned", true);
            setField(skin, "price", 0);
            setField(skin, "isInBox", false);
            setField(skin, "isInSpecialActivity", false);
        }

        try {
            const save = method(WeaponSkinManager, "Save2File", 1);
            invokeOriginal(save, instance, false);
        } catch (_) {}

        log(`Skins desbloqueadas: ${count}`);
    } catch (_) {}
}

Il2Cpp.perform(() => {
    const img = image();

    log("IL2CPP bridge carregado");

    try {
        const FPSPlayer = klass(img, "FPSPlayer");

        const start = method(FPSPlayer, "Start", 0);
        start.implementation = function (this: any, ...args: any[]): any {
            const ret = invokeOriginal(start, this, ...args);
            patchFPSPlayer(asObj(this));
            log("FPSPlayer.Start patchado");
            return ret;
        };

        const update = method(FPSPlayer, "Update", 0);
        update.implementation = function (this: any, ...args: any[]): any {
            patchFPSPlayer(asObj(this));
            return invokeOriginal(update, this, ...args);
        };

        const applyDamage1 = method(FPSPlayer, "ApplyDamage", 1);
        applyDamage1.implementation = function (this: any, ...args: any[]): any {
            patchFPSPlayer(asObj(this));
            log(`ApplyDamage(float) bloqueado: ${args[0]}`);
            return undefined;
        };

        const applyDamage5 = method(FPSPlayer, "ApplyDamage", 5);
        applyDamage5.implementation = function (this: any, ...args: any[]): any {
            patchFPSPlayer(asObj(this));
            log(`ApplyDamage(5 args) bloqueado: ${args[0]}`);
            return undefined;
        };

        log("Hooks de vida instalados em FPSPlayer");
    } catch (e) {
        log(`Falha em FPSPlayer: ${e}`);
    }

    try {
        const HealthScript = klass(img, "TacticalAI.HealthScript", "HealthScript");

        const damage = method(HealthScript, "Damage", 4);
        damage.implementation = function (this: any, ...args: any[]): any {
            const obj = asObj(this);
            const aiBase = getField(obj, "myAIBaseScript");

            if (!aiBase || aiBase.isNull()) {
                patchHealthScriptIfPlayer(obj);
                log(`HealthScript.Damage bloqueado: ${args[0]}`);
                return undefined;
            }

            return invokeOriginal(damage, this, ...args);
        };

        const reduce = method(HealthScript, "ReduceHealthAndShields", 2);
        reduce.implementation = function (this: any, ...args: any[]): any {
            const obj = asObj(this);
            const aiBase = getField(obj, "myAIBaseScript");

            if (!aiBase || aiBase.isNull()) {
                patchHealthScriptIfPlayer(obj);
                log(`ReduceHealthAndShields bloqueado: ${args[0]}`);
                return undefined;
            }

            return invokeOriginal(reduce, this, ...args);
        };

        log("Hooks extras de HealthScript instalados");
    } catch (e) {
        log(`HealthScript ignorado: ${e}`);
    }

    try {
        const ItemDataManager = klass(img, "DataCenter.ItemDataManager", "ItemDataManager");

        const getCurrency = method(ItemDataManager, "GetCurrency", 1);
        getCurrency.implementation = function (this: any, ...args: any[]): any {
            const type = Number(args[0]);

            if (type === 1 || type === 4 || type === 5 || type === 102) {
                return INF_MONEY;
            }

            return invokeStatic(getCurrency, ...args);
        };

        const setCurrency = method(ItemDataManager, "SetCurrency", 2);
        setCurrency.implementation = function (this: any, ...args: any[]): any {
            const type = Number(args[0]);

            if (type === 1 || type === 4 || type === 5 || type === 102) {
                return invokeStatic(setCurrency, type, INF_MONEY);
            }

            return invokeStatic(setCurrency, ...args);
        };

        giveMoney(img);
        log("Hooks de dinheiro instalados");
    } catch (e) {
        log(`Falha em dinheiro: ${e}`);
    }

    try {
        const WeaponSkinManager = klass(img, "WeaponSkinManager");

        const awake = method(WeaponSkinManager, "Awake", 0);
        awake.implementation = function (this: any, ...args: any[]): any {
            const ret = invokeOriginal(awake, this, ...args);
            unlockSkins(img);
            return ret;
        };

        const start = method(WeaponSkinManager, "Start", 0);
        start.implementation = function (this: any, ...args: any[]): any {
            const ret = invokeOriginal(start, this, ...args);
            unlockSkins(img);
            return ret;
        };

        const initSkins = method(WeaponSkinManager, "InitSkins", 0);
        initSkins.implementation = function (this: any, ...args: any[]): any {
            const ret = invokeOriginal(initSkins, this, ...args);
            unlockSkins(img);
            return ret;
        };

        log("Hooks de skins instalados em WeaponSkinManager");
    } catch (e) {
        log(`Falha em WeaponSkinManager: ${e}`);
    }

    try {
        const ShopSkinScript = klass(img, "ShopSkinScript");

        const init = method(ShopSkinScript, "Init", 3);
        init.implementation = function (this: any, ...args: any[]): any {
            const item = args[0] as Il2Cpp.Object;

            if (item && !item.isNull()) {
                setField(item, "owned", true);
                setField(item, "price", 0);
            }

            return invokeOriginal(init, this, ...args);
        };

        log("Hook de ShopSkinScript.Init instalado");
    } catch (e) {
        log(`ShopSkinScript ignorado: ${e}`);
    }

    setInterval(() => {
        patchLivePlayers(img);
        giveMoney(img);
        unlockSkins(img);
    }, 1000);

    log("Script carregado com sucesso");
});