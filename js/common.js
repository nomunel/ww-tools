const DUMMYURI = 'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA='


class GameDataManager {
    loadingScreen = document.getElementById('loading-screen');
    characterCcardSection = document.getElementById('character-card-section');
    constructor() {
        this.data = {};
        this.sessionKey = 'gameDataManagerData';
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

    getCharacterData() {
        return this.data.resonator || [];
    }

    getEchoData() {
        return this.data.echo || [];
    }

    getEchoSetData() {
        return this.data.echoSet || [];
    }

    getWeaponData() {
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




// GameDataManagerにデータ取得・キャッシュ管理機能を追加


// Debug button to manually refetch data
const debugButton = document.createElement('button');
debugButton.textContent = 'Refetch Game Data';
debugButton.style.position = 'fixed';
debugButton.style.bottom = '10px';
debugButton.style.right = '10px';
debugButton.style.zIndex = '1000';
debugButton.addEventListener('click', async () => {
    document.body.classList.add('loading');
    await gameDataManager.fetchData();
    sessionStorage.setItem(sessionKey, JSON.stringify(gameDataManager.data));
    document.body.classList.remove('loading');
    alert('Game data refetched successfully!');

    // Reload the page to ensure gameDataManager.data is properly initialized
    location.reload();
});
document.body.appendChild(debugButton);



// class LocalStorageManager {
//     constructor(prefix = '') {
//         this.prefix = prefix;
//     }

//     _getKey(key) {
//         return `${this.prefix}${key}`;
//     }

//     setItem(key, value) {
//         try {
//             const serializedValue = JSON.stringify(value);
//             localStorage.setItem(this._getKey(key), serializedValue);
//         } catch (error) {
//             console.error('Failed to set item in localStorage:', error);
//         }
//     }

//     getItem(key) {
//         try {
//             const serializedValue = localStorage.getItem(this._getKey(key));
//             return serializedValue ? JSON.parse(serializedValue) : null;
//         } catch (error) {
//             console.error('Failed to get item from localStorage:', error);
//             return null;
//         }
//     }

//     removeItem(key) {
//         try {
//             localStorage.removeItem(this._getKey(key));
//         } catch (error) {
//             console.error('Failed to remove item from localStorage:', error);
//         }
//     }

//     clear() {
//         try {
//             Object.keys(localStorage).forEach((key) => {
//                 if (key.startsWith(this.prefix)) {
//                     localStorage.removeItem(key);
//                 }
//             });
//         } catch (error) {
//             console.error('Failed to clear localStorage:', error);
//         }
//     }
// }

// export default LocalStorageManager;