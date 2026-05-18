import "frida-il2cpp-bridge";

const INF_MONEY = 999999999;
const INF_HP = 999999;

function log(msg: string) {
    console.log(`[CTF] ${msg}`);
}

function getImage(): Il2Cpp.Image {
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

function obj(self: any): Il2Cpp.Object {
    return self as unknown as Il2Cpp.Object;
}

function setField(o: Il2Cpp.Object, name: string, value: any): boolean {
    try {
        (o.field(name) as any).value = value;
        return true;
    } catch (_) {
        return false;
    }
}

function getField(o: Il2Cpp.Object, name: string): any {
    try {
        return (o.field(name) as any).value;
    } catch (_) {
        return null;
    }
}

function invokeInstance(self: any, name: string, argc: number, ...args: any[]): any {
    return (obj(self).method(name, argc) as any).invoke(...args);
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

function patchHealthScriptIfPlayer(h: Il2Cpp.Object) {
    const aiBase = getField(h, "myAIBaseScript");

    if (aiBase && !aiBase.isNull()) {
        return;
    }

    setField(h, "isGodMode", true);
    setField(h, "health", INF_HP);
    setField(h, "maxHealth", INF_HP);
    setField(h, "shields", INF_HP);
    setField(h, "maxShields", INF_HP);
}

function patchLivePlayers(img: Il2Cpp.Image) {
    try {
        const FPSPlayer = klass(img, "FPSPlayer");

        for (const p of Il2Cpp.gc.choose(FPSPlayer as any)) {
            patchFPSPlayer(p);
        }
    } catch (_) {}

    try {
        const HealthScript = klass(img, "TacticalAI.HealthScript", "HealthScript");

        for (const h of Il2Cpp.gc.choose(HealthScript as any)) {
            patchHealthScriptIfPlayer(h);
        }
    } catch (_) {}
}

function giveMoney(img: Il2Cpp.Image) {
    try {
        const ItemDataManager = klass(img, "DataCenter.ItemDataManager", "ItemDataManager");
        const setCurrency = method(ItemDataManager, "SetCurrency", 2);

        invokeStatic(setCurrency, 1, INF_MONEY); // GOLD
        invokeStatic(setCurrency, 4, INF_MONEY); // TICKET
        invokeStatic(setCurrency, 5, INF_MONEY); // WEAPONFRAGMENTS
    } catch (_) {}
}

function unlockSkinItem(item: Il2Cpp.Object | null) {
    if (!item || item.isNull()) {
        return;
    }

    setField(item, "owned", true);
    setField(item, "price", 0);
}

function unlockSkinsRuntimeOnly(img: Il2Cpp.Image) {
    try {
        const WeaponSkinManager = klass(img, "WeaponSkinManager");
        const instance = (WeaponSkinManager.field("Instance") as any).value as Il2Cpp.Object;

        if (!instance || instance.isNull()) {
            return;
        }

        const skins = (instance.field("weaponSkins") as any).value as Il2Cpp.Object;

        if (!skins || skins.isNull()) {
            return;
        }

        const count = listCount(skins);

        for (let i = 0; i < count; i++) {
            unlockSkinItem(listGet(skins, i));
        }
    } catch (_) {}
}

Il2Cpp.perform(() => {
    const img = getImage();

    log("IL2CPP bridge carregado");

    try {
        const FPSPlayer = klass(img, "FPSPlayer");

        const start = method(FPSPlayer, "Start", 0);
        start.implementation = function (this: any, ...args: any[]): any {
            const ret = invokeInstance(this, "Start", 0, ...args);
            patchFPSPlayer(obj(this));
            log("FPSPlayer.Start patchado");
            return ret;
        };

        const update = method(FPSPlayer, "Update", 0);
        update.implementation = function (this: any, ...args: any[]): any {
            patchFPSPlayer(obj(this));
            return invokeInstance(this, "Update", 0, ...args);
        };

        const applyDamage1 = method(FPSPlayer, "ApplyDamage", 1);
        applyDamage1.implementation = function (this: any, ...args: any[]): any {
            patchFPSPlayer(obj(this));
            log(`ApplyDamage(float) bloqueado: ${args[0]}`);
            return undefined;
        };

        const applyDamage5 = method(FPSPlayer, "ApplyDamage", 5);
        applyDamage5.implementation = function (this: any, ...args: any[]): any {
            patchFPSPlayer(obj(this));
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
            const self = obj(this);
            const aiBase = getField(self, "myAIBaseScript");

            if (!aiBase || aiBase.isNull()) {
                patchHealthScriptIfPlayer(self);
                log(`HealthScript.Damage bloqueado: ${args[0]}`);
                return undefined;
            }

            return invokeInstance(this, "Damage", 4, ...args);
        };

        const reduce = method(HealthScript, "ReduceHealthAndShields", 2);
        reduce.implementation = function (this: any, ...args: any[]): any {
            const self = obj(this);
            const aiBase = getField(self, "myAIBaseScript");

            if (!aiBase || aiBase.isNull()) {
                patchHealthScriptIfPlayer(self);
                log(`ReduceHealthAndShields bloqueado: ${args[0]}`);
                return undefined;
            }

            return invokeInstance(this, "ReduceHealthAndShields", 2, ...args);
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

            if (type === 1 || type === 4 || type === 5) {
                return INF_MONEY;
            }

            return invokeStatic(getCurrency, ...args);
        };

        const setCurrency = method(ItemDataManager, "SetCurrency", 2);
        setCurrency.implementation = function (this: any, ...args: any[]): any {
            const type = Number(args[0]);

            if (type === 1 || type === 4 || type === 5) {
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

        const findSkins = method(WeaponSkinManager, "FindSkins", 1);
        findSkins.implementation = function (this: any, ...args: any[]): any {
            const skin = invokeInstance(this, "FindSkins", 1, ...args) as Il2Cpp.Object;
            unlockSkinItem(skin);
            return skin;
        };

        log("Hook seguro de WeaponSkinManager.FindSkins instalado");
    } catch (e) {
        log(`WeaponSkinManager.FindSkins ignorado: ${e}`);
    }

    try {
        const ShopSkinScript = klass(img, "ShopSkinScript");

        const init = method(ShopSkinScript, "Init", 3);
        init.implementation = function (this: any, ...args: any[]): any {
            const item = args[0] as Il2Cpp.Object;
            unlockSkinItem(item);

            return invokeInstance(this, "Init", 3, ...args);
        };

        log("Hook seguro de ShopSkinScript.Init instalado");
    } catch (e) {
        log(`ShopSkinScript ignorado: ${e}`);
    }

    setInterval(() => {
        patchLivePlayers(img);
        giveMoney(img);
        unlockSkinsRuntimeOnly(img);
    }, 1500);

    log("Script carregado com sucesso");
});