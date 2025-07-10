const DUMMYURI = 'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA='


class GameDataManager {
    loadingScreen = document.getElementById('loading-screen');
    characterCcardSection = document.getElementById('character-card-section');
    constructor() {
        this.data = {};
        this.sessionKey = 'WWToolsDataBase';
    }

    async fetchDataFromServer() {
        const url = "https://script.google.com/macros/s/AKfycbyuQOrllcekjuZ_Dy7nM5W4h1xebNhzBaDcSWORK-Kuagt4BEWexFHNEy24_vZkkA0/exec";
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error("Network response was not ok");
            this.data = await response.json();
            sessionStorage.setItem(this.sessionKey, JSON.stringify(this.data));
            console.log("Game data fetched successfully");
        } catch (error) {
            console.error("データ取得エラー:", error);
        }
    }

    async loadData(callback, { forceFetch = false } = {}) {
        this.setLoadingState();
        if (!forceFetch) {
            const sessionData = sessionStorage.getItem(this.sessionKey);
            if (sessionData) {
                this.data = JSON.parse(sessionData);
                this.endLoadingState();
                if (typeof callback === 'function') callback(this.data);
                return;
            }
        }
        await this.fetchDataFromServer();
        this.endLoadingState();
        if (typeof callback === 'function') callback(this.data);
    }
    setLoadingState() {
    }
    endLoadingState() {
        this.loadingScreen.style.display = 'none';
        this.characterCcardSection.style.display = 'block';
    }

    getCharactersDB() {
        return this.data.resonator || [];
    }

    getEchosDB() {
        return this.data.echo || [];
    }

    getEchoSetsDB() {
        return this.data.echoSet || [];
    }

    getWeaponsDB() {
        return this.data.weapon || [];
    }
}

const gameDataManager = new GameDataManager();

// 使い方例：
// gameDataManager.loadData((data) => {
//     // data取得後の処理
// });
// 強制リロード例：
// gameDataManager.loadData((data) => { ... }, { forceFetch: true });




// // GameDataManagerにデータ取得・キャッシュ管理機能を追加


// // Debug button to manually refetch data
// const debugButton = document.createElement('button');
// debugButton.textContent = 'Refetch Game Data';
// debugButton.style.position = 'fixed';
// debugButton.style.bottom = '10px';
// debugButton.style.right = '10px';
// debugButton.style.zIndex = '1000';
// debugButton.addEventListener('click', async () => {
//     document.body.classList.add('loading');
//     await gameDataManager.fetchData();
//     sessionStorage.setItem(sessionKey, JSON.stringify(gameDataManager.data));
//     document.body.classList.remove('loading');
//     alert('Game data refetched successfully!');

//     // Reload the page to ensure gameDataManager.data is properly initialized
//     location.reload();
// });
// document.body.appendChild(debugButton);



class LocalStorageManager {
    constructor(key) {
        this.key = key; // 保存するキー名
    }

    // データを取得
    getData() {
        const data = localStorage.getItem(this.key);
        return data ? JSON.parse(data) : {}; // データがない場合は空オブジェクトを返す
    }

    // データを保存
    setData(data) {
        localStorage.setItem(this.key, JSON.stringify(data));
    }

    // 特定のプロパティを更新
    updateProperty(propertyPath, value) {
        const data = this.getData();
        const keys = propertyPath.split('.'); // プロパティパスを分割
        let current = data;

        // ネストされたプロパティを辿る
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!current[key]) current[key] = {}; // 存在しない場合はオブジェクトを作成
            current = current[key];
        }

        // 最後のプロパティに値を設定
        current[keys[keys.length - 1]] = value;

        // 更新後のデータを保存
        this.setData(data);
    }

    // 特定のプロパティを取得
    getProperty(propertyPath) {
        const data = this.getData();
        const keys = propertyPath.split('.');
        let current = data;

        for (const key of keys) {
            if (!current[key]) return undefined; // 存在しない場合は undefined を返す
            current = current[key];
        }

        return current;
    }
}


class EncoreWeaponInfo {
    constructor(lang, id) {
        this.lang = lang;
        this.id = id;
        this.data = null;
        this.fetchPromise = this.fetchData();
    }

    async fetchData() {
        const url = `https://api.encore.moe/${this.lang}/weapon/${this.id}?get=QualityId,WeaponType,Desc,Properties`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch weapon info');
        this.data = await response.json();
    }

    async ready() {
        // Wait for fetch to complete
        if (this.fetchPromise) await this.fetchPromise;
    }

    // 指定indexのプロパティのNameと、指定levelのGrowthValues.Value配列を返す
    async getProperties(index, level) {
        await this.ready();
        if (!this.data || !Array.isArray(this.data.Properties) || !this.data.Properties[index]) {
            return null;
        }
        const prop = this.data.Properties[index];
        const values = prop.GrowthValues
            .filter(gv => Number(gv.Level) === Number(level))
            .map(gv => gv.Value);
        return {
            Name: prop.Name,
            Values: values
        };
    }

    // 必要に応じて他の加工メソッドも追加可能
    async getDesc(rank) {
        await this.ready();
        return this.data ? this.data.Desc : '';
    }

    async getWeaponType() {
        await this.ready();
        return this.data ? this.data.WeaponType : '';
    }

    async getQualityId() {
        await this.ready();
        return this.data ? this.data.QualityId : '';
    }
}

/**
 * EncoreWeaponInfo を使って、全idの情報を取得しクリップボードにコピーする関数
 * csv形式で列見出しは ID, QualityId, WeaponType, Desc, Properties
 * 文字列以外はjson形式で出力
 */
async function exportAllEncoreWeaponInfoToClipboard(lang = 'ja') {
    const ids = [
    21010015, 21020015, 21030015, 21040015, 21050015, 21010024, 21020024, 21030024, 21040024, 21050024,
    21010013, 21020013, 21030013, 21040013, 21050013, 21010012, 21020012, 21030012, 21040012, 21050012,
    21010011, 21020011, 21030011, 21040011, 21050011, 21010023, 21020023, 21050023, 21010034, 21020034,
    21050034, 21010044, 21020044, 21030044, 21040044, 21050044, 21010043, 21020043, 21050043, 21010053,
    21020053, 21030053, 21040053, 21050053, 21010064, 21020064, 21030064, 21050064, 21030023, 21040023,
    21030034, 21040034, 21010074, 21020074, 21030074, 21040074, 21050074, 21010016, 21050016, 21010084,
    21020084, 21030084, 21050084, 21040064, 21030043, 21040043, 21010026, 21020016, 21010063, 21050026,
    21040016, 21050036, 21040084, 21020017, 21050017, 21020026, 21010094, 21020094, 21030094, 21040094,
    21050094, 21040026, 21030016, 21020036, 21050046, 21050027, 21050056, 21020046, 21040036, 21030026,
    21020056, 21010036, 21050066
    ];

    const header = ['ID', 'QualityId', 'WeaponType', 'Desc', 'Properties'];
    const rows = [header];

    for (const id of ids) {
        try {
            const info = new EncoreWeaponInfo(lang, id);
            await info.ready();
            const QualityId = await info.getQualityId();
            const WeaponType = await info.getWeaponType();
            const Desc = await info.getDesc();
            const Properties = info.data && info.data.Properties ? JSON.stringify(info.data.Properties) : '';
            rows.push([
                id,
                QualityId,
                WeaponType,
                `"${(Desc || '').replace(/"/g, '""')}"`, // CSVエスケープ
                `"${Properties.replace(/"/g, '""')}"`
            ]);
        } catch (e) {
            rows.push([id, '', '', '', '']);
        }
    }

    const csv = rows.map(row => row.join(',')).join('\n');
    await navigator.clipboard.writeText(csv);
    alert('EncoreWeaponInfoの全データをクリップボードにコピーしました');
}
// exportAllEncoreWeaponInfoToClipboard();














// export 機能を設ける

