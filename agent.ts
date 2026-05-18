import "frida-il2cpp-bridge";

const INF_MONEY = 999_999_999;
const INF_HP = 999_999;

function log(msg: string) {
    console.log(`[CTF] ${msg}`);
}

function getImage() {
    return Il2Cpp.domain.assembly("Assembly-CSharp").image;
}

function klass(image: Il2Cpp.Image, ...names: string[]) {
    for (const name of names) {
        try {
            return image.class(name);
        } catch (_) {}
    }
    throw new Error(`Classe não encontrada: ${names.join(" | ")}`);
}

function methodByArgs(c: Il2Cpp.Class, name: string, argc?: number) {
    const matches = c.methods.filter(m => {
        if (m.name !== name) return false;
        if (argc === undefined) return true;
        return m.parameters.length === argc;
    });

    if (matches.length === 0) {
        throw new Error(`Método não encontrado: ${c.name}.${name}/${argc ?? "*"}`);
    }

    return matches[0];
}

function setField(obj: Il2Cpp.Object, fieldName: string, value: any) {
    try {
        obj.field(fieldName).value = value;
        return true;
    } catch (_) {
        return false;
    }
}

function getField<T = any>(obj: Il2Cpp.Object, fieldName: string): T | null {
    try {
        return obj.field(fieldName).value as T;
    } catch (_) {
        return null;
    }
}

function listCount(listObj: Il2Cpp.Object): number {
    try {
        return listObj.method("get_Count").invoke() as number;
    } catch (_) {
        try {
            return listObj.field("_size").value as number;
        } catch (_) {
            return 0;
        }
    }
}

function listGet(listObj: Il2Cpp.Object, index: number): Il2Cpp.Object | null {
    try {
        return listObj.method("get_Item").invoke(index) as Il2Cpp.Object;
    } catch (_) {
        try {
            const items = listObj.field("_items").value as Il2Cpp.Array<Il2Cpp.Object>;
            return items.get(index);
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

function patchTacticalHealthIfPlayer(h: Il2Cpp.Object) {
    /*
      TacticalAI.HealthScript também existe no dump.
      Para não deixar inimigos imortais, só aplico quando não parece ser AI.
    */
    const aiBase = getField<Il2Cpp.Object>(h, "myAIBaseScript");

    if (aiBase && !aiBase.isNull()) {
        return;
    }

    setField(h, "isGodMode", true);
    setField(h, "health", INF_HP);
    setField(h, "maxHealth", INF_HP);
    setField(h, "shields", INF_HP);
    setField(h, "maxShields", INF_HP);
}

function patchAllLivePlayers(image: Il2Cpp.Image) {
    try {
        const FPSPlayer = klass(image, "FPSPlayer");
        for (const obj of Il2Cpp.gc.choose(FPSPlayer)) {
            patchFPSPlayer(obj);
        }
    } catch (_) {}

    try {
        const HealthScript = klass(image, "TacticalAI.HealthScript", "HealthScript");
        for (const obj of Il2Cpp.gc.choose(HealthScript)) {
            patchTacticalHealthIfPlayer(obj);
        }
    } catch (_) {}
}

function unlockAllSkins(image: Il2Cpp.Image) {
    try {
        const WeaponSkinManager = klass(image, "WeaponSkinManager");
        const instance = WeaponSkinManager.field("Instance").value as Il2Cpp.Object;

        if (!instance || instance.isNull()) {
            return;
        }

        const skins = instance.field("weaponSkins").value as Il2Cpp.Object;
        const count = listCount(skins);

        for (let i = 0; i < count; i++) {
            const skin = listGet(skins, i);
            if (!skin || skin.isNull()) continue;

            setField(skin, "owned", true);
            setField(skin, "price", 0);
            setField(skin, "isInBox", false);
            setField(skin, "isInSpecialActivity", false);
        }

        try {
            methodByArgs(WeaponSkinManager, "Save2File", 1).invoke(instance, false);
        } catch (_) {
            try {
                methodByArgs(WeaponSkinManager, "Save2File").invoke(instance);
            } catch (_) {}
        }

        log(`Skins desbloqueadas: ${count}`);
    } catch (e) {
        log(`unlockAllSkins falhou: ${e}`);
    }
}

function giveInfiniteMoney(image: Il2Cpp.Image) {
    try {
        const ItemDataManager = klass(image, "DataCenter.ItemDataManager", "ItemDataManager");

        try {
            methodByArgs(ItemDataManager, "SetCurrency", 2).invoke(1, INF_MONEY);   // GOLD
            methodByArgs(ItemDataManager, "SetCurrency", 2).invoke(4, INF_MONEY);   // TICKET
            methodByArgs(ItemDataManager, "SetCurrency", 2).invoke(5, INF_MONEY);   // WEAPONFRAGMENTS
        } catch (_) {}

        log("Dinheiro inicial aplicado");
    } catch (e) {
        log(`giveInfiniteMoney falhou: ${e}`);
    }
}

Il2Cpp.perform(() => {
    const image = getImage();

    log("IL2CPP inicializado");

    /*
      VIDA INFINITA — FPSPlayer
      Dump:
      FPSPlayer.isGodMode
      FPSPlayer.invulnerable
      FPSPlayer.hitPoints
      FPSPlayer.maximumHitPoints
      FPSPlayer.ApplyDamage(float)
      FPSPlayer.ApplyDamage(float, int, Transform, bool, KillType)
    */
    try {
        const FPSPlayer = klass(image, "FPSPlayer");

        const start = methodByArgs(FPSPlayer, "Start", 0);
        start.implementation = function () {
            const ret = start.invoke(this);
            patchFPSPlayer(this as Il2Cpp.Object);
            log("FPSPlayer.Start patchado com vida infinita");
            return ret;
        };

        const update = methodByArgs(FPSPlayer, "Update", 0);
        update.implementation = function () {
            patchFPSPlayer(this as Il2Cpp.Object);
            return update.invoke(this);
        };

        const applyDamage1 = methodByArgs(FPSPlayer, "ApplyDamage", 1);
        applyDamage1.implementation = function (damage: number) {
            patchFPSPlayer(this as Il2Cpp.Object);
            log(`ApplyDamage(float) bloqueado: ${damage}`);
            return;
        };

        const applyDamage5 = methodByArgs(FPSPlayer, "ApplyDamage", 5);
        applyDamage5.implementation = function (
            damage: number,
            targetId: number,
            attacker: Il2Cpp.Object,
            isMeleeAttack: boolean,
            killType: any
        ) {
            patchFPSPlayer(this as Il2Cpp.Object);
            log(`ApplyDamage(5 args) bloqueado: ${damage}`);
            return;
        };

        log("Hooks de FPSPlayer instalados");
    } catch (e) {
        log(`FPSPlayer hook falhou: ${e}`);
    }

    /*
      VIDA INFINITA — TacticalAI.HealthScript
      Não deixo inimigos imortais: só bloqueia quando myAIBaseScript parece nulo.
    */
    try {
        const HealthScript = klass(image, "TacticalAI.HealthScript", "HealthScript");

        const damage = methodByArgs(HealthScript, "Damage", 4);
        damage.implementation = function (
            dmg: number,
            targetId: number,
            killType: any,
            isHeadShot: boolean
        ) {
            const obj = this as Il2Cpp.Object;
            const aiBase = getField<Il2Cpp.Object>(obj, "myAIBaseScript");

            if (!aiBase || aiBase.isNull()) {
                patchTacticalHealthIfPlayer(obj);
                log(`TacticalAI.HealthScript.Damage bloqueado: ${dmg}`);
                return;
            }

            return damage.invoke(this, dmg, targetId, killType, isHeadShot);
        };

        const reduce = methodByArgs(HealthScript, "ReduceHealthAndShields", 2);
        reduce.implementation = function (dmg: number, isFromMine: boolean) {
            const obj = this as Il2Cpp.Object;
            const aiBase = getField<Il2Cpp.Object>(obj, "myAIBaseScript");

            if (!aiBase || aiBase.isNull()) {
                patchTacticalHealthIfPlayer(obj);
                log(`ReduceHealthAndShields bloqueado: ${dmg}`);
                return;
            }

            return reduce.invoke(this, dmg, isFromMine);
        };

        log("Hooks de TacticalAI.HealthScript instalados");
    } catch (e) {
        log(`HealthScript hook ignorado/falhou: ${e}`);
    }

    /*
      DINHEIRO INFINITO
      Dump:
      namespace DataCenter
      ItemDataManager.GetCurrency(CommonDataType type)
      ItemDataManager.SetCurrency(CommonDataType type, int num)

      CommonDataType:
      GOLD = 1
      GRENADE = 2
      MEDICAL = 3
      TICKET = 4
      WEAPONFRAGMENTS = 5
      SKIN = 102
    */
    try {
        const ItemDataManager = klass(image, "DataCenter.ItemDataManager", "ItemDataManager");

        const getCurrency = methodByArgs(ItemDataManager, "GetCurrency", 1);
        getCurrency.implementation = function (type: number) {
            if (type === 1 || type === 4 || type === 5 || type === 102) {
                return INF_MONEY;
            }

            return getCurrency.invoke(type);
        };

        const setCurrency = methodByArgs(ItemDataManager, "SetCurrency", 2);
        setCurrency.implementation = function (type: number, num: number) {
            if (type === 1 || type === 4 || type === 5 || type === 102) {
                return setCurrency.invoke(type, INF_MONEY);
            }

            return setCurrency.invoke(type, num);
        };

        giveInfiniteMoney(image);
        log("Hooks de dinheiro instalados");
    } catch (e) {
        log(`ItemDataManager hook falhou: ${e}`);
    }

    /*
      DESBLOQUEAR TODAS AS SKINS
      Dump:
      WeaponSkinManager.Instance
      WeaponSkinManager.weaponSkins
      WeaponSkinItem : PurchaseItem
      PurchaseItem.owned
    */
    try {
        const WeaponSkinManager = klass(image, "WeaponSkinManager");

        const awake = methodByArgs(WeaponSkinManager, "Awake", 0);
        awake.implementation = function () {
            const ret = awake.invoke(this);
            unlockAllSkins(image);
            return ret;
        };

        const start = methodByArgs(WeaponSkinManager, "Start", 0);
        start.implementation = function () {
            const ret = start.invoke(this);
            unlockAllSkins(image);
            return ret;
        };

        const initSkins = methodByArgs(WeaponSkinManager, "InitSkins", 0);
        initSkins.implementation = function () {
            const ret = initSkins.invoke(this);
            unlockAllSkins(image);
            return ret;
        };

        log("Hooks de WeaponSkinManager instalados");
    } catch (e) {
        log(`WeaponSkinManager hook falhou: ${e}`);
    }

    /*
      UI da loja: força cada item recebido pela ShopSkinScript.Init a entrar como owned.
    */
    try {
        const ShopSkinScript = klass(image, "ShopSkinScript");

        const init = methodByArgs(ShopSkinScript, "Init", 3);
        init.implementation = function (
            item: Il2Cpp.Object,
            choiceName: Il2Cpp.String,
            equipName: Il2Cpp.String
        ) {
            if (item && !item.isNull()) {
                setField(item, "owned", true);
                setField(item, "price", 0);
            }

            return init.invoke(this, item, choiceName, equipName);
        };

        log("Hook de ShopSkinScript.Init instalado");
    } catch (e) {
        log(`ShopSkinScript hook falhou: ${e}`);
    }

    /*
      Loop de manutenção:
      - reaplica vida;
      - reaplica dinheiro;
      - tenta desbloquear skins quando o manager já existir.
    */
    setInterval(() => {
        patchAllLivePlayers(image);
        giveInfiniteMoney(image);
        unlockAllSkins(image);
    }, 1000);

    log("Script carregado com sucesso");
});