import Tesseract from "https://cdn.jsdelivr.net/npm/tesseract.js@6/dist/tesseract.esm.min.js";
const { createWorker } = Tesseract;
const worker = await createWorker(['eng', 'jpn']);

const isDebugMode = false; // デバッグモードのフラグ
const TEST_SLOT = 2; // デバッグ用のスロット番号

const MAIN_STATUS_1_LABELS = [
    "HP",
    "攻撃力",
    "防御力",
    "共鳴効率",
    "クリティカル",
    "クリティカルダメージ",
    "凝縮ダメージアップ",
    "焦熱ダメージアップ",
    "電導ダメージアップ",
    "気動ダメージアップ",
    "回折ダメージアップ",
    "消滅ダメージアップ",
    "HP回復効果アップ",
];
const MAIN_STATUS_2_LABELS = [
    "HP",
    "攻撃力",
];
const SUB_STATUS_LABELS = [
    "HP",
    "攻撃力",
    "防御力",
    "共鳴効率",
    "クリティカル",
    "クリティカルダメージ",
    "通常攻撃ダメージアップ",
    "重撃ダメージアップ",
    "共鳴スキルダメージアップ",
    "共鳴解放ダメージアップ",
];

const WEAPON_TYPES = {
    "ja": ["長刃", "迅刀", "拳銃", "手甲", "増幅器"],
    "en": ["Broadblade", "Sword", "Pistols", "Gauntlets", "Rectifier"]
};


const WHITE_LIST = [...new Set([...MAIN_STATUS_1_LABELS, ...SUB_STATUS_LABELS].join(''))].join('') + '0123456789.%';


class ImageUtil {
    static getCharaImagePath(charaData, type) {
        if (!charaData || !type) {
            throw new Error('Invalid arguments: charaData and type are required.');
        }
        const validTypes = ['thumb', 'profile'];
        if (!validTypes.includes(type)) {
            throw new Error(`Invalid type: must be one of ${validTypes.join(', ')}`);
        }
        let name = charaData.nameEn.replaceAll(' ', '');
        if (name.startsWith("Rover")) {
            name += `-${charaData.Gender}`;
        }
        return `./img/common/chara/${type}/${name}.webp`;
    }
    static getWeaponImagePath(weaponData, type) {
        if (!weaponData.thumbID || !type) {
            throw new Error('Invalid arguments: weaponData and type are required.');
        }
        const validTypes = ['thumb', 'profile'];
        if (!validTypes.includes(type)) {
            throw new Error(`Invalid type: must be one of ${validTypes.join(', ')}`);
        }
        const thumbID = String(weaponData.thumbID || "").slice(3);
        return `./img/common/weapon/${WEAPON_TYPES["en"][weaponData.weaponType-1]}_${thumbID}.webp`;
    }
}


// 汎用ポップアップウィンドウ制御クラス
class TabSelecterModalView {
    /**
     * @param {string|HTMLElement} windowSelector - ポップアップウィンドウの要素またはID/CSSセレクタ
     */
    constructor(tabList) {
        this.populateModalHTML(tabList);

        // 閉じる処理
        this._escHandler = (e) => {
            if ((e.key === 'Escape' || e.key === 'Esc') && this.isOpen()) {
                this.hide();
            }
        };

        if (this.closeButton) {
            this.closeButton.addEventListener('click', () => this.hide());
        }
        if (this.backdrop) {
            this.backdrop.addEventListener('click', () => this.hide());
        }
        document.addEventListener('keydown', this._escHandler);

        // タブ機能
        this.tabs.forEach((button, index) => {
            button.addEventListener('click', () => {
                if (button.classList.contains('active')) {
                    // 既にactiveならactiveを外して全リスト表示
                    button.classList.remove('active');
                    this.filterListByAttribute('all');
                } else {
                    this.setActiveTab(button);
                }
            });
        });
    }
    populateModalHTML(tabList) {
        // --- Backdrop追加 ---
        const backdrop = document.createElement('div');
        backdrop.className = 'tab-selecter-modal-backdrop';
        backdrop.style.cssText = `
            position: fixed; z-index: 9998; left: 0; top: 0; width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.4); display: none;
        `;

        const modalElem = document.createElement('div');
        modalElem.className = 'tab-selecter-modal';
        modalElem.style.display = 'none';

        const tabNav = document.createElement('nav');
        tabList.forEach((tabLabel, index) => {
            const button = document.createElement('button');
            button.textContent = tabLabel;
            button.dataset.attribute = tabLabel;
            tabNav.appendChild(button);
        });
        modalElem.appendChild(tabNav);

        const itemsContainer = document.createElement('ul');
        modalElem.appendChild(itemsContainer);

        const closeButton = document.createElement('button');
        closeButton.className = 'close-button';
        closeButton.innerHTML = '<svg width="32" height="32"><use href="./img/common/icons/icons.svg#close"></use></svg>';
        modalElem.appendChild(closeButton);

        document.body.appendChild(backdrop);
        document.body.appendChild(modalElem);

        this.modalElem = modalElem;
        this.tabNav = tabNav;
        this.tabs = tabNav.querySelectorAll('button');
        this.itemsContainer = itemsContainer;
        this.closeButton = closeButton;
        this.backdrop = backdrop;
    }
    isolate(attribute) {
        // タブを指定して、他のタブを非表示にする
        this.tabs.forEach((tab) => {
            if (tab.dataset.attribute === attribute) {
                this.setActiveTab(tab);
                return;
            }
        });
        this.tabNav.style.display = 'none'; // タブナビゲーションを非表示
    }
    unIsolate() {
        this.tabNav.style.display = 'block';
    }

    show() {
        if (this.modalElem) this.modalElem.style.display = 'block';
        if (this.backdrop) this.backdrop.style.display = 'block';
    }

    hide() {
        if (this.modalElem) this.modalElem.style.display = 'none';
        if (this.backdrop) this.backdrop.style.display = 'none';
    }

    isOpen() {
        return this.modalElem && this.modalElem.style.display === 'block';
    }

    destroy() {
        document.removeEventListener('keydown', this._escHandler);
        if (this.backdrop) this.backdrop.remove();
        if (this.modalElem) this.modalElem.remove();
    }

    /**
     * 汎用: リストHTML生成（例: キャラ・武器など）
     * @param {Array} items - 表示するデータ配列（name, srcのみを含む）
     * @param {function} onItemClick - アイテムクリック時のコールバック (item, index, originalItem) => void
     * @param {Array} [database] - 元データ配列（必要なら渡す）
     */
    renderList(items, onItemClick, database) {
        // seelcterContainerを使う
        this.itemsContainer.innerHTML = '';
        items.forEach((item, idx) => {
            const liElement = document.createElement('li');
            liElement.dataset.attribute = item.attr;
            // name, src以外は共通HTML
            liElement.innerHTML = `<img width="128" height="128" alt="${item.name}" src="${item.src}">`;
            liElement.addEventListener('click', () => onItemClick(database ? database[idx] : undefined));
            this.itemsContainer.appendChild(liElement);
        });
        // 初期アクティブ
        // this.setActiveTab(this.tabs[0]);
    }

    setActiveTab(selectTabElem) {
        const selectAttr = selectTabElem.dataset.attribute;
        this.tabs.forEach((tab) => {
            tab.classList.toggle('active', selectAttr === tab.dataset.attribute);
        });
        this.filterListByAttribute(selectAttr);
    }

    /**
     * 属性でリストをフィルタリング（キャラ選択用）
     * @param {string} selectAttr
     */
    filterListByAttribute(selectAttr) {
        const characterItems = this.itemsContainer.querySelectorAll('li');
        characterItems.forEach(item => {
            item.style.display = 'none';
        });
        characterItems.forEach(item => {
            if (item.dataset.attribute === selectAttr || selectAttr === 'all') {
                item.style.display = 'block';
            }
        });
    }
}

class CharaSelecter {
    constructor() {
        this.selectedCharacterFigure = document.getElementById('selected-character-figure');
        this.selectedCharacterImg = this.selectedCharacterFigure.querySelector('img');
        this.selectedCharacterName = document.querySelector('#chara-name b');
        this.selectedCharacterElementType = document.querySelector('#chara-name img');
        this.charaChangeButton = document.getElementById('chara-change-button');

        this.hpInput = document.getElementById('chara-hp');
        this.atkInput = document.getElementById('chara-atk');
        this.defInput = document.getElementById('chara-def');

        this.tabList = ["凝縮", "焦熱", "電導", "気動", "回折", "消滅"]
        this.tabSelecterModalView = new TabSelecterModalView(this.tabList);

        this.charactersDB = gameDataManager.getCharactersDB();
        this.init();
    }

    init() {
        // DBソート
        this.charactersDB.sort((a, b) => {
            // 並び順: this.tabList（属性順）→レアリティ降順→かな順
            const attrOrderA = this.tabList.indexOf(a.element);
            const attrOrderB = this.tabList.indexOf(b.element);
            if (attrOrderA !== attrOrderB) return attrOrderA - attrOrderB;
            if (b.rarity !== a.rarity) return b.rarity - a.rarity;
            return a.kana.localeCompare(b.kana);
        });

        // ModalViewのリスト生成
        const charaListData = this.charactersDB.map(charaDB => ({
            name: charaDB.name,
            attr: charaDB.element,
            src: ImageUtil.getCharaImagePath(charaDB, 'thumb')
        }));
        this.tabSelecterModalView.renderList(
            charaListData,
            (charaDB) => {
                this.setSelectedCharacter(charaDB);
            },
            this.charactersDB
        );

        this.addEventListeners();
    }

    setSelectedCharacter(charaDB) {
        this.selectedCharacterElementType.src = `./img/common/icons/elements/${charaDB.elementEn}.webp`;
        this.selectedCharacterName.textContent = charaDB.name;
        this.selectedCharacterImg.src = ImageUtil.getCharaImagePath(charaDB, 'profile');
        this.tabSelecterModalView.hide();
        
        this.updateBaseStatus(charaDB);
        this.updateChain();

        const event = new CustomEvent('characterChanged', { detail: charaDB });
        document.dispatchEvent(event);
    }
    updateBaseStatus(charaDB) {
        this.hpInput.value = charaDB.baseHP || 0;
        this.atkInput.value = charaDB.baseATK || 0;
        this.defInput.value = charaDB.baseDEF || 0;
    }

    updateChain() {
        // 実装例: チェイン情報をUIに反映する処理
    }

    addEventListeners() {
        this.charaChangeButton.addEventListener('click', () => {
            this.tabSelecterModalView.show();
        });
    }
}


class WeaponSelecter {
    constructor() {
        this.weaponDataElem = document.getElementById('weapon-data');
        this.weaponNameElem = this.weaponDataElem.querySelector('h2');
        this.weaponImgElem = this.weaponDataElem.querySelector('figure img');
        this.weaponFigureElem = this.weaponDataElem.querySelector('figure');
        this.weaponTable = this.weaponDataElem.querySelector('table');
        this.weaponChangeButton = document.getElementById('weapon-change-button');
        this.tuningRankSelect = this.weaponDataElem.querySelector('#weapon-tuning-rank select');
        this.syntonizeElem = this.weaponDataElem.querySelector('.syntonize');

        this.tabSelecterModalView = new TabSelecterModalView(WEAPON_TYPES["ja"]);
        this.weaponsDB = gameDataManager.getWeaponsDB();
        this.selectedWeaponDB = null;

        this.init();
    }

    init() {
        // ソート
        this.weaponsDB.sort((a, b) => {
            // 並び順: WEAPON_TYPES（type順）→レアリティ降順→名前順
            const typeOrderA = WEAPON_TYPES["ja"].indexOf(a.type);
            const typeOrderB = WEAPON_TYPES["ja"].indexOf(b.type);
            if (typeOrderA !== typeOrderB) return typeOrderA - typeOrderB;
            if (b.rarity !== a.rarity) return b.rarity - a.rarity;
            return a.name.localeCompare(b.name);
        });

        // 属性リスト生成

        // 一覧データ生成
        const weaponListData = this.weaponsDB.map(w => ({
            name: w.name,
            attr: WEAPON_TYPES["ja"][w.weaponType - 1],
            src: ImageUtil.getWeaponImagePath(w, 'thumb')
        }));

        this.tabSelecterModalView.renderList(
            weaponListData,
            (weaponDB) => {
                this.setSelectedWeapon(weaponDB);
            },
            this.weaponsDB
        );

        this.addEventListeners();
        // 初期選択
        if (this.weaponsDB.length > 0) {
            this.setSelectedWeapon(this.weaponsDB[0]);
        }
    }

    addEventListeners() {
        this.weaponChangeButton.addEventListener('click', () => {
            this.tabSelecterModalView.show();
        });
        this.tuningRankSelect.addEventListener('change', () => {
            this.updateTuningRank();
        });
    }
    setSelectedWeaponById(weaponId, rank=1) {
        const weaponDB = this.weaponsDB.find(w => w.id === weaponId);
        if (weaponDB) {
            this.setSelectedWeapon(weaponDB, rank);
        } else {
            console.warn(`Weapon with ID ${weaponId} not found.`);
        }
    }
    setSelectedWeapon(weaponDB, rank=1) {
        this.selectedWeaponDB = weaponDB;
        // 画像
        this.weaponImgElem.src = ImageUtil.getWeaponImagePath(weaponDB, 'thumb');
        // レアリティ
        this.weaponFigureElem.className = `rank${weaponDB.rarity}`;
        // 名前
        this.weaponNameElem.childNodes[0].nodeValue = weaponDB.name;
        // ステータス
        const propertyName1 = weaponDB.propertyName1 || 'undefined';
        const propertyValue1 = weaponDB.propertyValue1 || 0;
        const propertyName2 = weaponDB.propertyName2 || 'undefined';
        let propertyValue2 = weaponDB.propertyValue2 || 0;
        if (typeof propertyValue2 === 'number' && !Number.isInteger(propertyValue2)) {
            propertyValue2 = (propertyValue2 * 100).toFixed(1) + '%';
        }
        const rows = this.weaponTable.querySelectorAll('tr');
        if (rows[0]) {
            rows[0].querySelector('th').textContent = propertyName1;
            // 小数点以下を四捨五入して整数にする
            let value1 = propertyValue1;
            value1 = Math.round(parseFloat(value1));
            rows[0].querySelector('td').textContent = value1;
        }

        if (rows[1]) {
            rows[1].querySelector('th').textContent = propertyName2;
            // 小数の場合は小数点第二位で四捨五入し、小数点第一位まで表示
            let value2 = propertyValue2;
            if (typeof value2 === 'string' && value2.endsWith('%')) {
                let num = parseFloat(value2.replace('%', ''));
                num = Math.round(num * 10) / 10; // 四捨五入して小数点第一位まで
                value2 = num.toFixed(1) + '%';
            }
            rows[1].querySelector('td').textContent = value2;
        }
        // 調律ランク
        this.tuningRankSelect.value = rank;

        // シントナイズ効果の更新
        this.updateSyntonize();

        // 調律ランク変更時にシントナイズ効果を更新
        this.tuningRankSelect.onchange = () => this.updateSyntonize();

        this.tabSelecterModalView.hide();

        // イベント発火
        const event = new CustomEvent('weaponChanged', { detail: weaponDB });
        document.dispatchEvent(event);
    }

    updateSyntonize(weaponDB = this.selectedWeaponDB) {
        let desc = weaponDB.desc || '';
        desc = desc.replace(/<span[^>]*>([\d.]+(?:%|)(?:\/[\d.]+(?:%|)){4})<\/span>/g, (match, p1) => {
            const vals = p1.split('/');
            const idx = Math.max(0, Math.min(4, Number(this.tuningRankSelect.value) - 1));
            return `<span>${vals[idx]}</span>`;
        });
        this.syntonizeElem.innerHTML = desc || '';
        // イベント発火
        const {id, weaponType} = weaponDB;
        const rank = this.tuningRankSelect.value;
        const event = new CustomEvent('syntonizeChanged', { detail:{id, weaponType, rank} });
        document.dispatchEvent(event);
    }

    updateTuningRank() {
        // 調律ランク変更時の処理（必要に応じて拡張）
        // 例: ステータスや説明文の更新
        // this.selectedWeapon, this.tuningRankSelect.value
    }
}




/**
 * SubtotalListManager
 * echo-listの合計Substatus一覧を管理
 * echo-listが更新されるたびに、各ステータスの合計値を計算し、リストに反映
 */
class SubtotalListManager {
    constructor(echoScoreCalculator) {
        this.echoScoreCalculator = echoScoreCalculator || new EchoScoreCalculator();
        this.echoLis = document.querySelectorAll('#echo-list li');
        this.totalScoreElem = document.querySelector('#total-score p');
        
        // base status input id map
        this.baseStatusInputIds = {
            "HP": "chara-hp",
            "攻撃力": "chara-atk",
            "防御力": "chara-def"
        };
        this.baseStatusInputs = {};
        for (const key in this.baseStatusInputIds) {
            const id = this.baseStatusInputIds[key];
            this.baseStatusInputs[key] = document.getElementById(id);
        }

        // subtotal-score-list内のinput要素を取得し、data-attributeをkey、nextSiblingをvalueとするオブジェクトを作成
        this.subTotalScoreElems = {};
        document.querySelectorAll('#subtotal-score-list input').forEach(input => {
            const key = input.dataset.attribute;
            if (key) {
                // nextSiblingがテキストノードの場合は次の要素ノードを探す
                let elem = input.nextSibling;
                while (elem && elem.nodeType !== 1) {
                    elem = elem.nextSibling;
                }
                this.subTotalScoreElems[key] = elem;
            }
        });

        // サブステータス名とinput要素のIDの対応
        this.statusMap = [
            { label: "HP", id: "echo-total-hp" },
            { label: "攻撃力", id: "echo-total-atk" },
            { label: "防御力", id: "echo-total-def" },
            { label: "共鳴効率", id: "echo-total-energy-regen" },
            { label: "クリティカル", id: "echo-total-critical-per" },
            { label: "クリティカルダメージ", id: "echo-total-critical-dmg" },
            { label: "通常攻撃ダメージアップ", id: "echo-total-normal-atk" },
            { label: "重撃ダメージアップ", id: "echo-total-heavy-atk" },
            { label: "共鳴スキルダメージアップ", id: "echo-total-skill-atk" },
            { label: "共鳴解放ダメージアップ", id: "echo-total-liberation-atk" }
        ];
        // 合計値を格納
        this.subTotals = {};
        // input要素参照
        this.inputs = {};
        this.statusMap.forEach(item => {
            this.inputs[item.label] = document.getElementById(item.id);
        });
    }

    /**
     * echo-listのli要素からサブステータス合計を計算し、反映
     */
    update() {
        // 初期化
        this.statusMap.forEach(item => {
            this.subTotals[item.label] = 0;
        });


        this.echoLis.forEach(li => {
            // sub-statusテーブルのtbody > tr
            li.querySelectorAll('.sub-status tbody tr').forEach(tr => {
                const th = tr.querySelector('th');
                const td = tr.querySelector('td');

                const label = th.textContent.trim();
                let value = td.textContent.trim();
                // 数値部分だけ抽出
                let num = 0;
                if (value.endsWith('%')) {
                    num = parseFloat(value.replace('%', ''));
                }
                else {
                    // 基礎値参照して%換算
                    const baseInput = this.baseStatusInputs[label];
                    const base = baseInput ? parseFloat(baseInput.value) : 0;
                    num = base ? (parseFloat(value) / base * 100) : 0;
                }
                this.subTotals[label] += num;
            });
        });

        // inputに反映
        this.statusMap.forEach(item => {
            const label = item.label;
            const input = this.inputs[label];
            let val = this.subTotals[label];
            val = val.toFixed(1) + '%';
            input.value = val;

            // labelに該当するfactorを取得して、比重値が0だったら liに disabled という classを付与（トグル式）
            const factorInput = this.echoScoreCalculator.factorInputs[label];
            const factorValue = factorInput ? parseFloat(factorInput.value) : 0;
            input.parentNode.classList.toggle('disabled', factorValue === 0);
        });

        this.updateSubTotalScores()
        this.updateTotalScore();
    }
    updateSubTotalScores() {
        // 各input（合計値input）についてスコアを計算し、subTotalScoreElemsに反映
        Object.entries(this.inputs).forEach(([label, input]) => {
            // input.valueは "xx.x%" 形式なので %を除去して数値化
            let percentValue = parseFloat((input.value || "0").replace("%", ""));

            // factor取得
            const factor = parseFloat(this.echoScoreCalculator.factorInputs[label].value) || 0.0;

            // スコア計算
            let score = percentValue * factor;
            score = Math.floor(score * 10) / 10;

            // subTotalScoreElems[label] に反映（要素があれば）
            this.subTotalScoreElems[label].textContent = score.toFixed(1);

            // トグル: 0ならdisabledを付与、0以外なら外す
            this.subTotalScoreElems[label].parentNode.classList.toggle('disabled', score === 0);
        });
    }
    updateTotalScore(){
        // this.subTotalScoreElems のスコアを合計して、this.totalScoreElem に適用
        let total = 0;
        Object.values(this.subTotalScoreElems).forEach(elem => {
            if (elem && elem.textContent) {
            const val = parseFloat(elem.textContent);
            if (!isNaN(val)) total += val;
            }
        });
        this.totalScoreElem.textContent = Math.floor(total).toString();
    }
}


class SubtotalScoreListView {
    constructor(defaultFactors, customFactors, scoreFactorType) {
        this.charaDB = gameDataManager.getCharactersDB();
        this.container = document.getElementById('subtotal-score-list');
        this.factorTypeSelect = document.getElementById('factor-type-select');
        this.inputs = {
            "HP": document.getElementById('factor-hp'),
            "攻撃力": document.getElementById('factor-atk'),
            "防御力": document.getElementById('factor-def'),
            "共鳴効率": document.getElementById('factor-energy-regen'),
            "クリティカル": document.getElementById('factor-critical-per'),
            "クリティカルダメージ": document.getElementById('factor-critical-dmg'),
            "通常攻撃ダメージアップ": document.getElementById('factor-normal-atk'),
            "重撃ダメージアップ": document.getElementById('factor-heavy-atk'),
            "共鳴スキルダメージアップ": document.getElementById('factor-skill-atk'),
            "共鳴解放ダメージアップ": document.getElementById('factor-liberation-atk')
        };
        this.defaultFactors = {...defaultFactors}
        this.customFactors = {...customFactors };
        this.setFactorType(scoreFactorType); // 初期はデフォルトファクターを設定
        this.setType(scoreFactorType);

        this.observeTypeChange();
        this.observeFactorChange();
    }

    setFactorType(type) {
        let isReadOnly = false;
        if (type === 'default') {
            this.setFactors(this.defaultFactors);
            isReadOnly = true;
        }
        else if (type === 'custom') {
            this.setFactors(this.customFactors);
        }
        Object.values(this.inputs).forEach(input => {
            input.readOnly = isReadOnly;
        });
    }

    observeTypeChange() {
        this.onTypeChange((type) => {
            this.setFactorType(type);
        });
    }
    observeFactorChange() {
        this.onFactorChange((e) => {
            const input = e.target;
            // 小数点第一まで表示（例: 1 → 1.0, 1.23 → 1.2）
            const value = parseFloat(input.value > 0 ? input.value : 0 );
            if (!isNaN(value)) {
                input.value = value.toFixed(1); // 小数第一位にフォーマット
            }
            // let val = parseFloat(input.value);
            // if (!isNaN(val)) {
            //     // 1や1.0なども必ず1.0形式で表示
            //     input.value = (Math.floor(val * 10) / 10).toFixed(1);
            // }
        });
    }

    getFactors() {
        const factors = {};
        for (const key in this.inputs) {
            factors[key] = parseFloat(this.inputs[key].value) || 0;
        }
        return factors;
    }

    setFactors(factorObj = {}) {
        const factors = {...this.defaultFactors, ...factorObj };
        for (const key in this.inputs) {
            let value;
            if (!factors[key]) {
                value = 0.0; // デフォルト値を設定
            }
            else {
                value = factors[key];
            }
            this.inputs[key].value = parseFloat(value).toFixed(1); // 小数第一位にフォーマット
        }
    }

    setType(type) {
        this.factorTypeSelect.value = type;
    }

    getType() {
        return this.factorTypeSelect.value;
    }

    onTypeChange(callback) {
        this.factorTypeSelect.addEventListener('change', () => {
            callback(this.getType());
        });
    }

    onFactorChange(callback) {
        Object.values(this.inputs).forEach(input => {
            input.addEventListener('change', (e) => {
                callback(e);
            });
        });
    }
}



class ResonanceChainController {
    constructor(callback) {
        this.callback = callback || (() => {});
        this.container = document.getElementById('resonance-chain');
        if (!this.container) throw new Error('Resonance chain container not found');
        this.imgs = Array.from(this.container.querySelectorAll('img'));
        this.init();
    }

    init() {
        this.imgs.forEach((img, idx) => {
            img.addEventListener('click', () => this.handleClick(idx));
        });
    }
    handleClick(idx) {
        let chainNum = idx;
        if (idx === 0) {
            // 1つ目だけONの時にクリックしたらOFF
            const onlyFirstOn = this.isOn(this.imgs[0]) && this.imgs.slice(1).every(img => !this.isOn(img));
            if (onlyFirstOn) {
                this.setImgState(0, false);
                chainNum = -1; // OFF状態を示す
                this.callback(chainNum);
                return;
            }
        }
        // Set all left (including clicked) to ON, rest to OFF
        for (let i = 0; i < this.imgs.length; i++) {
            this.setImgState(i, i <= idx);
        }
        this.callback(chainNum);
    }

    isOn(img) {
        return img.src.includes('_ON');
    }

    setImgState(idx, on) {
        const img = this.imgs[idx];
        img.src = img.src.replace(/_ON|_OFF/, on ? '_ON' : '_OFF');
    }
}
new ResonanceChainController(((chainNum) => {
    // Callback function to handle chain number changes
    console.log('Resonance chain updated:', chainNum);
    // You can add additional logic here if needed
}))


/* #weapon-data のUI機能を担当するクラス
HTMLの構成
```
        <div id="weapon-data">
            <h2>Weapon Name
                <button id="weapon-change-button">
                    <svg width="32" height="32"><use href="./img/common/icons/icons.svg#change"></use></svg>
                </button>
            </h2>
            <figure class="rank5"><img src="./img/common/weapon/Broadblade_0011.webp" width="132" height="132"></figure>
            <table>
                <tr><th>攻撃力</th><td>500</td></tr>
                <tr><th>クリティカルダメージ</th><td>24.4%</td></tr>
            </table>
            <p id="weapon-tuning-rank"><label>調律ランク<select name="">
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
            </select></label></p>
            <p class="syntonize" data-buff="30%">攻撃力12%アップ。通常攻撃発動時、以下の効果を獲得：自身の与ダメージが目標の防御力を8%無視する他、自身が直接与える【騒光効果】ダメージに、50%のダメージブーストを付与する。この効果は6秒間持続し、再獲得すると持続時間がリセットされる。</p>
        </div>
```
機能
- 武器の変更
    - #weapon-change-button をクリックすると、武器の一覧が表示される
    - 武器の画像表示
- 武器の調律ランクの変更

更新箇所
*/





// View: OCRWindowView
class OCRWindowView {
    constructor() {
        this.characterCardSection = document.getElementById('character-card-section');
        this.ocrWindow = document.getElementById('echo-scan-window');
        this.pasteArea = document.getElementById('ocr-paste-area');
        this.calcScoreButton = document.getElementById('calc-score-button');
        this.resultTextArea = document.getElementById('ocr-result-textarea');
        this.closeBtn = document.getElementById('close-ocr-window');
        this.matchedEchoThumb = document.getElementById('matched-echo-thumb');
        this.cropedPasteImage = document.getElementById('croped-paste-image');
        this.reloadBtn = document.createElement('button');
        this.blurControl = this.createSlider('ぼかし: ', 0, 5, 0.5, 1.0);
        this.sharpControl = this.createSlider('エッジ強調: ', 0, 5, 0.5, 1.0);
        this.contrastControl = this.createSlider('コントラスト: ', -100, 100, 1, 0);
        this.cropInputsAppended = false;
        this.echoCropInputsAppended = false;
        this.echoCropPreviewImg = null;
        this.echoCropInputs = null;
        this.cropInputs = {};
        this.charaNameCropInputsAppended = false;
        this.charaNameCropPreviewImg = null;
        this.charaNameCropInputs = null;
    }
    setupControls() {
        this.reloadBtn.innerText = '再読み込み';
        this.reloadBtn.style.margin = '8px 0';
        this.ocrWindow.appendChild(this.blurControl.wrapper);
        this.ocrWindow.appendChild(this.sharpControl.wrapper);
        this.ocrWindow.appendChild(this.contrastControl.wrapper);
        this.ocrWindow.appendChild(this.reloadBtn);
        document.body.appendChild(this.ocrWindow);
    }
    createSlider(labelText, min, max, step, defaultValue, unit = '') {
        const wrapper = document.createElement('div');
        wrapper.style.marginBottom = '6px';
        const label = document.createElement('label');
        label.innerText = labelText;
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = min;
        slider.max = max;
        slider.step = step;
        slider.value = defaultValue;
        slider.style.width = '60%';
        const input = document.createElement('input');
        input.type = 'number';
        input.min = min;
        input.max = max;
        input.step = step;
        input.value = defaultValue;
        input.style.width = '60px';
        input.style.marginLeft = '8px';
        slider.oninput = () => (input.value = slider.value);
        input.oninput = () => {
            let v = parseFloat(input.value);
            if (v < min) v = min;
            if (v > max) v = max;
            slider.value = v;
        };
        wrapper.appendChild(label);
        wrapper.appendChild(slider);
        wrapper.appendChild(input);
        if (unit) {
            const unitElement = document.createElement('span');
            unitElement.innerText = unit;
            unitElement.style.marginLeft = '4px';
            wrapper.appendChild(unitElement);
        }
        return { wrapper, slider, input };
    }
    showWindow() {
        this.ocrWindow.style.display = 'block';
    }
    hideWindow() {
        this.ocrWindow.style.display = 'none';
    }
    setResultText(text) {
        this.resultTextArea.value = text;
    }
    setCropedPasteImage(src, w, h) {
        this.cropedPasteImage.src = src;
        this.cropedPasteImage.style.width = w + 'px';
        this.cropedPasteImage.style.height = h + 'px';
    }
    setMatchedEchoThumb(src) {
        this.matchedEchoThumb.src = src;
    }
    // --- Crop UI for debug ---
    setupCropInputs(defaults, slotIndex, onChange) {
        if (!this.cropInputsAppended) {
            ['swRate', 'shRate', 'sxRate', 'syRate'].forEach(key => {
                const wrapper = document.createElement('div');
                wrapper.style.marginBottom = '4px';
                wrapper.innerHTML = `<label>${key}</label>
                    <input type="number" value="${defaults[key][slotIndex]||defaults[key]}" min="0.01" max="1" step="0.001" style="width:60px;margin-left:8px;">`;
                this.ocrWindow.appendChild(wrapper);
                this.cropInputs[key] = wrapper.querySelector('input');
                this.cropInputs[key].onchange = onChange;
            });
            this.cropInputsAppended = true;
        }
    }
    updateCropInputs(defaults, slotIndex) {
        this.cropInputs.swRate.value = defaults.swRate;
        this.cropInputs.shRate.value = defaults.shRate;
        this.cropInputs.sxRate.value = defaults.sxRate[slotIndex];
        this.cropInputs.syRate.value = defaults.syRate;
    }
    // --- Echo Crop UI for debug ---
    setupEchoCropInputs(cropValues, slotIndex, canvas, onChange) {
        if (!this.echoCropInputsAppended) {
            const echoCropWrapper = document.createElement('div');
            echoCropWrapper.style.margin = '8px 0';
            echoCropWrapper.innerHTML = `
                <label>Echo画像切り出し位置 (x, y, w, h): </label>
                <input type="number" min="0" max="${canvas.width}" step="1" value="${cropValues.x[slotIndex]}" style="width:60px;" id="echo-crop-x">
                <input type="number" min="0" max="${canvas.height}" step="1" value="${cropValues.y}" style="width:60px;" id="echo-crop-y">
                <input type="number" min="1" max="${canvas.width}" step="1" value="${cropValues.w}" style="width:60px;" id="echo-crop-w">
                <input type="number" min="1" max="${canvas.height}" step="1" value="${cropValues.h}" style="width:60px;" id="echo-crop-h">
            `;
            this.ocrWindow.appendChild(echoCropWrapper);
            this.echoCropInputs = {
                x: document.getElementById('echo-crop-x'),
                y: document.getElementById('echo-crop-y'),
                w: document.getElementById('echo-crop-w'),
                h: document.getElementById('echo-crop-h')
            };
            ['x', 'y', 'w', 'h'].forEach(key => {
                this.echoCropInputs[key].addEventListener('change', () => onChange(canvas));
            });
            this.echoCropInputsAppended = true;
        }
    }
    updateEchoCropPreview(canvas) {
        if (!this.echoCropPreviewImg) {
            this.echoCropPreviewImg = document.createElement('img');
            this.echoCropPreviewImg.alt = 'Echo Crop Preview';
            this.echoCropPreviewImg.style.display = 'block';
            this.echoCropPreviewImg.style.margin = '10px auto';
            this.echoCropPreviewImg.style.maxWidth = '100%';
            this.ocrWindow.appendChild(this.echoCropPreviewImg);
        }
        const cropX = parseInt(this.echoCropInputs.x.value, 10) || 0;
        const cropY = parseInt(this.echoCropInputs.y.value, 10) || 0;
        const cropW = parseInt(this.echoCropInputs.w.value, 10) || canvas.width;
        const cropH = parseInt(this.echoCropInputs.h.value, 10) || canvas.height;
        const echoCropCanvas = document.createElement('canvas');
        echoCropCanvas.width = cropW;
        echoCropCanvas.height = cropH;
        echoCropCanvas.getContext('2d').drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        this.echoCropPreviewImg.src = echoCropCanvas.toDataURL();
    }
    setupCharaNameCropInputs(cropValues, canvas, onChange) {
        if (!this.charaNameCropInputsAppended) {
            const wrapper = document.createElement('div');
            wrapper.style.margin = '8px 0';
            wrapper.innerHTML = `
                <hr>
                <p>キャラ名切り出し</p>
                <label>sxRate: </label><input type="number" min="0" max="1" step="0.001" value="${cropValues.sxRate}" style="width:60px;" id="chara-crop-sxRate">
                <label>syRate: </label><input type="number" min="0" max="1" step="0.001" value="${cropValues.syRate}" style="width:60px;" id="chara-crop-syRate">
                <label>swRate: </label><input type="number" min="0" max="1" step="0.001" value="${cropValues.swRate}" style="width:60px;" id="chara-crop-swRate">
                <label>shRate: </label><input type="number" min="0" max="1" step="0.001" value="${cropValues.shRate}" style="width:60px;" id="chara-crop-shRate">
            `;
            this.ocrWindow.appendChild(wrapper);
            this.charaNameCropInputs = {
                sxRate: document.getElementById('chara-crop-sxRate'),
                syRate: document.getElementById('chara-crop-syRate'),
                swRate: document.getElementById('chara-crop-swRate'),
                shRate: document.getElementById('chara-crop-shRate')
            };
            Object.values(this.charaNameCropInputs).forEach(input => {
                input.addEventListener('change', () => onChange(canvas));
            });
            this.charaNameCropInputsAppended = true;
        }
    }
    updateCharaNameCropPreview(canvas) {
        if (!this.charaNameCropPreviewImg) {
            this.charaNameCropPreviewImg = document.createElement('img');
            this.charaNameCropPreviewImg.alt = 'Chara Name Crop Preview';
            this.charaNameCropPreviewImg.style.display = 'block';
            this.charaNameCropPreviewImg.style.margin = '10px auto';
            this.charaNameCropPreviewImg.style.maxWidth = '100%';
            this.charaNameCropPreviewImg.style.border = '1px solid red';
            this.ocrWindow.appendChild(this.charaNameCropPreviewImg);
        }
        const sxRate = parseFloat(this.charaNameCropInputs.sxRate.value) || 0;
        const syRate = parseFloat(this.charaNameCropInputs.syRate.value) || 0;
        const swRate = parseFloat(this.charaNameCropInputs.swRate.value) || 0;
        const shRate = parseFloat(this.charaNameCropInputs.shRate.value) || 0;

        const sx = canvas.width * sxRate;
        const sy = canvas.height * syRate;
        const sw = canvas.width * swRate;
        const sh = canvas.height * shRate;

        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = sw;
        cropCanvas.height = sh;
        cropCanvas.getContext('2d').drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
        this.charaNameCropPreviewImg.src = cropCanvas.toDataURL();
    }
}

// Controller: OCRWindowController
class OCRWindowController {
    constructor() {
        this.imgData = null;
        this.img = new Image();
        this.ocrResultData = null; // EchoModelインスタンスを格納
        this.echoImageList = null;

        this.view = new OCRWindowView();
        this.isDebugMode = typeof isDebugMode !== "undefined" ? isDebugMode : false;
        this.init();
    }
    dispatchLoadedOcrEvent(ocrResult, slotIndex){
        const event = new CustomEvent('loadedOCR', { detail: { ocrResult, slotIndex } });
        document.dispatchEvent(event);
    }
    init() {
        if (isDebugMode) {
            this.view.setupControls();
        }
        this.addEventListeners();
    }
    addEventListeners() {
        if (isDebugMode) {
            this.view.closeBtn.onclick = () => this.view.hideWindow();
            this.view.reloadBtn.onclick = () => this.applyFiltersAndOCR(TEST_SLOT);
        }

        this.view.pasteArea.addEventListener('paste', (e) => this.handlePaste(e));
        this.view.pasteArea.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.view.characterCardSection.classList.remove('dragover');
            this.handlePaste(e);
        });
        
        this.view.characterCardSection.addEventListener('dragover', (e) => {
            // const isClassAdded = this.view.characterCardSection.classList.contains('dragover')
            // if (isClassAdded) return;
            e.preventDefault();
            e.stopPropagation();
            this.view.characterCardSection.classList.add('dragover');
        });
        this.view.characterCardSection.addEventListener('dragleave', (e) => {
            // 子要素からのdragleaveは無視する
            if (!e.relatedTarget || !this.view.characterCardSection.contains(e.relatedTarget)) {
                e.preventDefault();
                e.stopPropagation();
                this.view.characterCardSection.classList.remove('dragover');
            }
        });
        this.view.characterCardSection.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.view.characterCardSection.classList.remove('dragover');
        });
    }
    handlePaste(event) {
        if (isDebugMode) {
            this.view.showWindow();
        }
        
        let items = [];
        if (event.type === 'paste') {
            items = event.clipboardData.items;
        } else if (event.type === 'drop') {
            items = event.dataTransfer.items;
        }
        if (!items[0]?.type?.startsWith('image/')) {
            alert('画像データが見つかりませんでした。画像を貼り付けまたはドロップしてください。');
            return;
        }
        const imageFile = items[0].getAsFile();
        const reader = new FileReader();
        reader.onload = (ev) => {
            this.imgData = ev.target.result;
            this.applyFiltersAndOCRs();
        };
        reader.readAsDataURL(imageFile);
    }
    fixMainStatus2(){
        // mainStatus2 の穴埋め
        let cost = this.ocrResultData.cost;

        if (cost === '1') {
            this.ocrResultData.propertyName = 'HP';
            this.ocrResultData.value = 2280;
        }
        else if (cost === '3') {
            this.ocrResultData.propertyName = '攻撃力';
            this.ocrResultData.value = 100;
        }
        else if (cost === '4') {
            this.ocrResultData.propertyName = '攻撃力';
            this.ocrResultData.value = 150;
        }
    }
    applyFiltersAndOCRs() {
        const imgData = this.imgData;
        if (!imgData) return;
        this.img.onload = async () => {
            const isLarge = this.img.width > 1000;
            if (isLarge) {
                await this.charaNameOCR();
                await this.weaponNameOCR();

                if (isDebugMode) {
                    this.applyFiltersAndOCR(TEST_SLOT);
                }
                else{
                    // 5つのエコースロットを順にOCR
                    for (let index = 0; index < 5; index++) {
                        this.applyFiltersAndOCR(index);
                    }
                }
            } else {
                this.applyFiltersAndOCR(-1);
            }
        };
        this.img.src = imgData;
    }

    async charaNameOCR() {
        // isLargeの場合、左上のキャラ名を読み取ってキャラを切り替える
        const charaNameCanvas = document.createElement('canvas');
        const ctx = charaNameCanvas.getContext('2d');
        
        const cropDefaults = { sxRate: 0.035, syRate: 0.02, swRate: 0.36, shRate: 0.055 };
        let sx, sy, sw, sh;

        if (this.isDebugMode) {
            this.view.setupCharaNameCropInputs(cropDefaults, this.img, (canvas) => {
                this.view.updateCharaNameCropPreview(canvas);
            });
            this.view.updateCharaNameCropPreview(this.img);
            const inputs = this.view.charaNameCropInputs;
            sx = this.img.width * parseFloat(inputs.sxRate.value);
            sy = this.img.height * parseFloat(inputs.syRate.value);
            sw = this.img.width * parseFloat(inputs.swRate.value);
            sh = this.img.height * parseFloat(inputs.shRate.value);
        } else {
            sx = this.img.width * cropDefaults.sxRate;
            sy = this.img.height * cropDefaults.syRate;
            sw = this.img.width * cropDefaults.swRate;
            sh = this.img.height * cropDefaults.shRate;
        }

        const scale = 1;
        charaNameCanvas.width = sw * scale;
        charaNameCanvas.height = sh * scale;;
        ctx.drawImage(this.img, sx, sy, sw, sh, 0, 0, sw * scale, sh * scale);


        // OCRでキャラ名を取得
        (async () => {
            const worker = await createWorker('jpn');
            const { data: { text } } = await worker.recognize(charaNameCanvas, {
                // tessedit_char_blacklist: '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳０１２３４５６７８９',
                preserve_interword_spaces: true,
            });
            
            const ocrCharaName = text.replace(/\s/g, '');
            const charactersDB = gameDataManager.getCharactersDB();
            let foundCharaDB = null;
            let tempName = ocrCharaName;
            while (tempName.length > 0) {
                foundCharaDB = charactersDB.find(c => c.name.includes(tempName));
                if (foundCharaDB) {
                    break; // Match found, exit loop
                }
                // No match, shorten the name from the end and retry
                tempName = tempName.slice(0, -1);
            }

            if (foundCharaDB) {
                const event = new CustomEvent('characterChanged', { detail: foundCharaDB });
                document.dispatchEvent(event);
            }
        })();
    }
    async weaponNameOCR() {
        const weaponNameCanvas = document.createElement('canvas');
        const ctx = weaponNameCanvas.getContext('2d');
        
        const cropDefaults = { sxRate: 0.83, syRate: 0.415, swRate: 0.152, shRate: 0.055 };
        const sx = this.img.width * cropDefaults.sxRate;
        const sy = this.img.height * cropDefaults.syRate;
        const sw = this.img.width * cropDefaults.swRate;
        const sh = this.img.height * cropDefaults.shRate;

        const scale = 2;
        weaponNameCanvas.width = sw * scale;
        weaponNameCanvas.height = sh * scale;
        ctx.drawImage(this.img, sx, sy, sw, sh, 0, 0, sw * scale, sh * scale);

        (async () => {
            const worker = await createWorker('jpn');
            const { data: { text } } = await worker.recognize(weaponNameCanvas, {
                // tessedit_char_blacklist: '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳０１２３４５６７８９',
                preserve_interword_spaces: true,
            });
            
            const ocrWeaponName = text.replace(/\s/g, '');
            const weaponsDB = gameDataManager.getWeaponsDB();
            let foundWeaponDB = null;
            let tempName = ocrWeaponName;
            while (tempName.length > 0) {
                foundWeaponDB = weaponsDB.find(c => c.name.includes(tempName));
                if (foundWeaponDB) {
                    break; // Match found, exit loop
                }
                // No match, shorten the name from the end and retry
                tempName = tempName.slice(0, -1);
            }
            if (!foundWeaponDB) {
                let tempName = ocrWeaponName;
                while (tempName.length > 0) {
                    foundWeaponDB = weaponsDB.find(c => c.name.includes(tempName));
                    if (foundWeaponDB) {
                        break; // Match found, exit loop
                    }
                    // No match, shorten the name from the start and retry
                    tempName = tempName.slice(1);
                }
                
            }
            console.log('ocrWeaponName:', ocrWeaponName);

            if (foundWeaponDB) {
                const event = new CustomEvent('weaponChanged', { detail: foundWeaponDB });
                document.dispatchEvent(event);
            }
        })();
    }
    applyFiltersAndOCR(slotIndex = 0, isRetry = false) {
        const img = this.img;
        const isLarge = this.img.width > 1000;
        let sx = 0, sy = 0, sw = img.width, sh = img.height;
        // --- Crop ---
        if (isLarge) {
            const defaults = {
                swRate: 0.163,
                shRate: 0.3,
                sxRate: [0.033, 0.23, 0.424, 0.619, 0.814],
                syRate: 0.03
            };
            this.view.setupCropInputs(defaults, slotIndex, () => this.applyFiltersAndOCR(slotIndex));
            this.view.updateCropInputs(defaults, slotIndex);
            const swRate = parseFloat(this.view.cropInputs.swRate.value);
            const shRate = parseFloat(this.view.cropInputs.shRate.value);
            const sxRate = parseFloat(this.view.cropInputs.sxRate.value);
            const syRate = parseFloat(this.view.cropInputs.syRate.value);
            sw = Math.floor(img.width * swRate);
            sh = Math.floor(img.height * shRate);
            sx = Math.floor(img.width * sxRate);
            sy = img.height - sh - Math.floor(img.height * syRate);
        }
        // --- Canvas ---
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const scale = 3;
        canvas.width = sw * scale;
        canvas.height = sh * scale;
        ctx.filter = `blur(${this.view.blurControl.slider.value}px)`;
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw * scale, sh * scale);
        ctx.filter = 'none';
        if (isLarge) {
            ctx.fillStyle = 'rgba(17, 11, 21, 1)';
            ctx.fillRect(0, 0, canvas.width * 0.475, canvas.height * 0.36);
        }
        // --- Sharp/Contrast ---
        let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let data = imageData.data;
        const w = canvas.width, h = canvas.height;
        const copy = new Uint8ClampedArray(data);
        const sharp = parseFloat(this.view.sharpControl.slider.value);
        if (sharp > 0) {
            const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
            for (let y = 1; y < h - 1; y++) {
                for (let x = 1; x < w - 1; x++) {
                    for (let c = 0; c < 3; c++) {
                        let i = (y * w + x) * 4 + c, sum = 0, k = 0;
                        for (let ky = -1; ky <= 1; ky++) {
                            for (let kx = -1; kx <= 1; kx++) {
                                let ni = ((y + ky) * w + (x + kx)) * 4 + c;
                                sum += copy[ni] * kernel[k++];
                            }
                        }
                        data[i] = Math.min(255, Math.max(0, sum * sharp));
                    }
                }
            }
        }
        const contrastInput = this.view.contrastControl.slider;
        // if (!isRetry) contrastInput.value = '0';

        let contrast = parseFloat(contrastInput.value);
        if (contrast !== 0) {
            const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
            for (let i = 0; i < data.length; i += 4) {
                for (let j = 0; j < 3; j++) {
                    data[i + j] = Math.min(255, Math.max(0, factor * (data[i + j] - 128) + 128));
                }
            }
        }
        ctx.putImageData(imageData, 0, 0);
        // --- Preview ---
        this.view.setCropedPasteImage(canvas.toDataURL(), sw, sh);
        // --- OCR ---
        (async () => {
            const worker = await createWorker(['eng', 'jpn']);
            const { data: { text } } = await worker.recognize(canvas, {
                tessedit_char_whitelist: WHITE_LIST,
                // tessedit_char_blacklist: '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳０１２３４５６７８９',
                preserve_interword_spaces: true,
            });
            let cleanedText = this.cleanText(text);
            if (isLarge) cleanedText = 'NoName\nNoCost\n' + cleanedText;
            this.view.setResultText(cleanedText);
            // EchoModelインスタンスを格納
            this.ocrResultData = new OcrParser(cleanedText).parse();

            // --- 自己チェック＆contrast自動調整 ---
            const check = this.ocrResultData.selfCheck();
            console.log('OCR Result Check / Slot:', check, slotIndex);
            if (!check.valid && contrast > -50) {
                // contrastを-10下げて再実行
                contrastInput.value = contrast - 25;
                this.applyFiltersAndOCR(slotIndex, true);
                return;
            }
            // 成功 or contrastが-50まで下がったらcallback
            if (isLarge) {
                // TODO: Largeだから、ではなく一律不足情報を補完する関数を設けてやる（updateFromOcr側の処理をこっちに持ってくる）
                this.showEchoCropAndMatchUI(img, slotIndex);
            } else {
                this.dispatchLoadedOcrEvent(this.ocrResultData, slotIndex);
            }
        })();
    }
    cleanText(text) {
        return text
            .replace(/[\u200B-\u200D\uFEFF]/g, '')
            .replace(/[\x00-\x09\x0B-\x0C\x0E-\x1F]/g, '')
            .replace(/(?<! ) (?! )/g, '')
            .replace(/\r\n|\r/g, '\n')
            .replace(/[ ]*\n[ ]*/g, '\n')
            .trim();
    }
    showEchoCropAndMatchUI(img, slotIndex) {
        const cost = this.ocrResultData?.cost || 1;
        const echoImgDir = './img/common/echo/';
        const cropValues = {
            x: [22, 397, 771, 1145, 1518],
            y: 651,
            w: 190,
            h: 180,
        };
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        if (this.isDebugMode) {
            this.view.setupEchoCropInputs(cropValues, slotIndex, canvas, (canvasRef) => this.view.updateEchoCropPreview(canvasRef));
            this.view.updateEchoCropPreview(canvas);
        } else {
            this.view.echoCropInputs = {
                x: { value: cropValues.x[slotIndex] },
                y: { value: cropValues.y },
                w: { value: cropValues.w },
                h: { value: cropValues.h }
            };
        }
        if (!this.echoImageList) {
            const echoData = gameDataManager.getEchosDB();
            this.echoImageList = {
                cost1: echoData.filter(e => e.cost === 1).map(e => echoImgDir + 'cost1/' + e.id + '.webp'),
                cost3: echoData.filter(e => e.cost === 3).map(e => echoImgDir + 'cost3/' + e.id + '.webp'),
                cost4: echoData.filter(e => e.cost === 4).map(e => echoImgDir + 'cost4/' + e.id + '.webp'),
            };
        }
        let imageListToSearch = [];
        if (cost === '不明') {
            // コスト不明の場合、全コストの画像を検索対象にする
            imageListToSearch = [
            ...this.echoImageList.cost1,
            ...this.echoImageList.cost3,
            ...this.echoImageList.cost4
            ];
        } else {
            imageListToSearch = this.echoImageList['cost' + cost] || [];
        }

        this.updateEchoMatch(canvas, imageListToSearch, slotIndex);
    }
    updateEchoMatch(canvas, echoImageList, slotIndex) {
        const cropX = parseInt(this.view.echoCropInputs.x.value, 10) || 0;
        const cropY = parseInt(this.view.echoCropInputs.y.value, 10) || 0;
        const cropW = parseInt(this.view.echoCropInputs.w.value, 10) || canvas.width;
        const cropH = parseInt(this.view.echoCropInputs.h.value, 10) || canvas.height;
        const echoCropCanvas = document.createElement('canvas');
        echoCropCanvas.width = cropW;
        echoCropCanvas.height = cropH;
        echoCropCanvas.getContext('2d').drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        const getImageData = (imgElem, w, h) => {
            const c = document.createElement('canvas');
            c.width = w; c.height = h;
            c.getContext('2d').drawImage(imgElem, 0, 0, w, h);
            return c.getContext('2d').getImageData(0, 0, w, h).data;
        };
        const compareImages = (data1, data2) => {
            let diff = 0;
            for (let i = 0; i < data1.length; i += 4) {
                diff += Math.abs(data1[i] - data2[i]);
                diff += Math.abs(data1[i + 1] - data2[i + 1]);
                diff += Math.abs(data1[i + 2] - data2[i + 2]);
            }
            return diff;
        };
        const cropData = getImageData(echoCropCanvas, cropW, cropH);
        let bestMatch = null, bestScore = Infinity;
        let loaded = 0;
        echoImageList.forEach(filePath => {
            const imgElem = new window.Image();
            imgElem.crossOrigin = 'anonymous';
            imgElem.onload = () => {
                const w = cropW, h = cropH;
                const data = getImageData(imgElem, w, h);
                const score = compareImages(cropData, data);
                if (score < bestScore) {
                    bestScore = score;
                    bestMatch = filePath;
                }
                loaded++;
                if (loaded === echoImageList.length) {
                    if (bestMatch) {
                        this.view.setMatchedEchoThumb(bestMatch);
                        const src = this.view.matchedEchoThumb.src;
                        if (src.includes('echo')) {
                            const fileName = src.split('/').pop().split('.')[0];
                            const echoData = gameDataManager.getEchosDB();
                            const matchedEcho = echoData.find(e => String(e.id) === fileName);
                            if (matchedEcho) {
                                // EchoModelインスタンスのnameを書き換え
                                if (this.ocrResultData instanceof EchoModel) {
                                    this.ocrResultData.name = matchedEcho.name;
                                    this.ocrResultData.id = matchedEcho.id;
                                    this.ocrResultData.elementType = matchedEcho.element;
                                    this.ocrResultData.cost = matchedEcho.cost;
                                    this.fixMainStatus2();
                                }
                                const echoSelect = document.getElementById('echo-select');
                                for (const option of echoSelect.querySelectorAll('option')) {
                                    if (option.value === matchedEcho.name) {
                                        option.selected = true;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    this.dispatchLoadedOcrEvent(this.ocrResultData, slotIndex);
                }
            };
            imgElem.src = filePath;
        });
    }
}






// OCR結果の文字列を解析して、OCRが誤認した情報を修正、欲しい情報形式のObject化する機能を実装
class OcrParser {
    constructor(text) {
        this.text = text || '';
        this.labels = [...new Set([...MAIN_STATUS_1_LABELS, ...SUB_STATUS_LABELS])];
    }

    normalizeParamPart(paramPart) {
        if (paramPart.includes("攻撃") && !paramPart.includes("ダメージアップ")) return "攻撃力";
        if (paramPart.includes("防御")) return "防御力";

        paramPart = paramPart.replace('・', '').replace('%', '');
        for (let i = this.labels.length - 1; i >= 0; i--) {
            const label = this.labels[i];
            if (paramPart.includes(label)) {
            return label;
            }
        }
        paramPart = paramPart.slice(1);
        for (let i = 0; i < this.labels.length; i++) {
            const label = this.labels[i];
            if (label.includes(paramPart)) {
            return label;
            }
        }
        return this.getClosestLabel(paramPart);
    }
    getValuePart(text) {
        text = text.replace(
            /[^\u4E00-\u9FAF\u3040-\u309F\u30A0-\u30FFa-zA-Z0-9.%]/g, ''
        );
        let percentMatch = text.match(/(\d{1,3}\.\d+%|\d{1,3}%)/);
        const numberMatch = text.match(/(\d{2,4})/);  // mainStatus2のHPで4桁がありえる
        return percentMatch ? percentMatch[0] : (numberMatch ? numberMatch[0] : '');
    }

    getClosestLabel(paramPart) {
        const similarity = (a, b) => {
            let matches = 0;
            for (let i = 0; i < Math.min(a.length, b.length); i++) {
                if (a[i] === b[i]) matches++;
            }
            return matches / Math.max(a.length, b.length);
        };

        let bestMatch = paramPart,
            highestScore = 0;
        for (const label of this.labels) {
            const score = similarity(paramPart, label);
            if (score > highestScore) {
                highestScore = score;
                bestMatch = label;
            }
        }
        return bestMatch;
    }

    parse() {
        let lines = this.text.split('\n')
        const tempLines = [];

        lines.forEach(line => {
            if (line !== ''){
                tempLines.push(line)
            }
        });
        lines = tempLines

        // Prepare EchoModel fields
        let echoName = "";
        let cost = "";
        let mainStatus1 = { propertyName: "", value: "" };
        let mainStatus2 = { propertyName: "", value: "" };
        let subStatus = Array(5).fill().map(() => ({ propertyName: "", value: "" }));

        if (lines.length) {
            const isNoName = lines[0].startsWith('NoName');

            // echoName: allow leading "・"
            if (isNoName) {
                echoName = "No Name";
            } else {
                echoName = lines[0].slice(0, -1).replace(/[\s\p{P}\p{S}@]{1,3}$/gu, '');
            }

            // COST
            const costMatch = lines[1].match(/cost(\d)/i);
            cost = costMatch ? costMatch[1] : '不明';

            // Main Status 1
            if (isNoName) {
                // NoNameの場合、Main Status 1 のvalueが改行されているので、1行にまとめる
                lines[2] = lines[2] + lines[3]
                lines.splice(3, 1);
            }
            if (lines[2].startsWith('+2')) {
                // lines[2]が"+2"から始まる場合は除去（+25 ～ の行を削除）
                lines.splice(2, 1);
            }
            const mainStatus1Line = lines[2];
            const value1 = this.getValuePart(mainStatus1Line)
            let param1Part = mainStatus1Line.replace(value1, '')
            const paramName1 = this.normalizeParamPart(param1Part);

            // Main Status 2
            const mainStatus2Line = lines[3];
            const value2 = this.getValuePart(mainStatus2Line)
            let param2Part = mainStatus2Line.replace(value2, '')
            const paramName2 = this.normalizeParamPart(param2Part);

            mainStatus1 = {
                propertyName: paramName1,
                value: value1
            };
            mainStatus2 = {
                propertyName: paramName2,
                value: value2
            };

            // mainStatus2 の穴埋め
            if (cost === '不明') {
                const v2 = parseFloat(mainStatus2.value);
                if (v2 === 100) cost = '3';
                else if (v2 === 150) cost = '4';
                else if (v2 > 150) cost = '1';
            }
            if (cost === '1') {
                mainStatus2.propertyName = 'HP';
                mainStatus2.value = 2280;
            }
            else if (cost === '3') {
                mainStatus2.propertyName = '攻撃力';
                mainStatus2.value = 100;
            }
            else if (cost === '4') {
                mainStatus2.propertyName = '攻撃力';
                mainStatus2.value = 150;
            }


            // Sub Status
            const subStatusLines = lines.slice(-5); // Get the last 5 lines
            subStatus = subStatusLines.map(text => {
                const subStatusValue = this.getValuePart(text)
                let paramPart = text.replace(subStatusValue, '');
                const subStatusParamName = this.normalizeParamPart(paramPart);

                return {
                    propertyName: subStatusParamName,
                    value: subStatusValue
                };
            });
        }

        // Return EchoModel instance
        return new EchoModel({
            name: echoName,
            cost: cost,
            mainStatus1: mainStatus1,
            mainStatus2: mainStatus2,
            subStatus: subStatus
        });
    }
}

/*
EchoのScore計算をするクラス

引数で値を渡されたら、それを元に計算して返す
わたってくる項目は SUB_STATUS_LABELS がkeyのオブジェクト
kyeごとにあわせた計算して、計算結果の数値を返す

計算方法
- value から %を取り除いた数値 * facter （例： value が 10.5% で、factorが2.0だったら、21をreturn）
- valueに %がついていない場合は、次の内容に沿って%に変換してから計算
    - 次のkeyについては %なしがありえる
        - HP, 攻撃力, 防御力
    - 「参考基礎ステータス」の値を参照して計算
        - value / 「参考基礎ステータス」の値 * 100
        - 例: valueが 1000 で、参考基礎ステータスの攻撃力が 2000 の場合、1000 / 2000 * 100 = 50% として計算
keyにかかわる factor の input id の相対表
    "HP": "factor-hp"
    "攻撃力": "factor-atk"
    "防御力": "factor-def"
    "共鳴効率": "factor-energy-regen"
    "クリティカル": "factor-critical-per"
    "クリティカルダメージ": "factor-critical-dmg"
    "通常攻撃ダメージアップ": "factor-normal-atk"
    "重撃ダメージアップ": "factor-heavy-atk"
    "共鳴スキルダメージアップ": "factor-skill-atk"
    "共鳴解放ダメージアップ": "factor-liberation-atk"
%なしvalueを計算する際に用いる「参考基礎ステータス」のinput id
    "HP": "chara-hp"
    "攻撃力": "chara-attack"
    "防御力": "chara-defense"
*/

class EchoScoreCalculator {
    constructor() {
        // factor input id map
        this.factorInputIds = {
            "HP": "factor-hp",
            "攻撃力": "factor-atk",
            "防御力": "factor-def",
            "共鳴効率": "factor-energy-regen",
            "クリティカル": "factor-critical-per",
            "クリティカルダメージ": "factor-critical-dmg",
            "通常攻撃ダメージアップ": "factor-normal-atk",
            "重撃ダメージアップ": "factor-heavy-atk",
            "共鳴スキルダメージアップ": "factor-skill-atk",
            "共鳴解放ダメージアップ": "factor-liberation-atk"
        };
        // base status input id map
        this.baseStatusInputIds = {
            "HP": "chara-hp",
            "攻撃力": "chara-atk",
            "防御力": "chara-def"
        };
        // 事前にinput要素を取得してキャッシュ
        this.factorInputs = {};
        for (const key in this.factorInputIds) {
            const id = this.factorInputIds[key];
            this.factorInputs[key] = document.getElementById(id);
        }
        this.baseStatusInputs = {};
        for (const key in this.baseStatusInputIds) {
            const id = this.baseStatusInputIds[key];
            this.baseStatusInputs[key] = document.getElementById(id);
        }
    }

    /**
     * 
     * @param {HTMLElement} labelElem - ステータス名が入ったth/td/labelなど
     * @param {HTMLElement} valueElem - 値が入ったtd/inputなど
     * @param {HTMLElement} resultElem - 計算結果を出力する要素
     * @returns {number} - 計算されたスコア
     */
    calc(labelElem, valueElem, resultElem) {
        // ラベル取得
        let key = labelElem.textContent?.trim() || labelElem.value?.trim() || "";
        if (!key) {
            if (resultElem) resultElem.textContent = "0.0";
            return 0;
        }

        // 値取得
        let value = valueElem.textContent?.trim();
        if (value == null || value === "") value = valueElem.value?.trim();
        if (value == null || value === "") {
            if (resultElem) resultElem.textContent = "0.0";
            return 0;
        }

        let percentValue;
        if (typeof value === "string" && value.includes("%")) {
            percentValue = parseFloat(value.replace("%", ""));
        } else if (["HP", "攻撃力", "防御力"].includes(key)) {
            // %なしの場合は基礎値参照
            let baseInput = this.baseStatusInputs[key];
            let base = baseInput ? parseFloat(baseInput.value) : 0;
            percentValue = base ? (parseFloat(value) / base * 100) : 0;
        } else {
            percentValue = parseFloat(value);
        }
        // factor取得
        let factorInput = this.factorInputs[key];
        let factor = factorInput ? parseFloat(factorInput.value) : 1.0;

        // 小数点第二位以下は削除（切り捨て）、必ず小数点第一まで表記
        let result = percentValue * factor;
        result = Math.floor(result * 10) / 10;
        if (resultElem) resultElem.textContent = result.toFixed(1);
        return result.toFixed(1);
    }
}


// TODO: デバックで使ってたやつ、多分もういらないので後で書くにして削除
class ScoreCheckerUI {
    constructor() {
        this.echoSelect = document.getElementById('echo-select');
        this.mainOption1 = document.getElementById('main-option-1');
        this.mainOption1Value = document.getElementById('main-option-1-value');
        this.mainOption2 = document.getElementById('main-option-2');
        this.mainOption2Value = document.getElementById('main-option-2-value');
        this.subStatusTable = document.querySelector('#sub-status-table tbody');
        this.echoData = [];
        this.init();
    }

    init() {
        this.echoData = gameDataManager.getEchosDB();
        this.initEchoSelect();
        this.initMainStatusTable();
        this.initSubStatusTable();
    }

    initMainStatusTable() {
        this.mainOption1.innerHTML = '';
        MAIN_STATUS_1_LABELS.forEach(optionValue => {
            const option = document.createElement('option');
            option.value = optionValue;
            option.textContent = optionValue;
            console.log('mainOption1:', option);
            this.mainOption1.appendChild(option);
        });

        this.mainOption2.innerHTML = '';
        MAIN_STATUS_2_LABELS.forEach(optionValue => {
            const option = document.createElement('option');
            option.value = optionValue;
            option.textContent = optionValue;
            this.mainOption2.appendChild(option);
        });
    }

    initSubStatusTable() {
        const selects = this.subStatusTable.querySelectorAll('select');
        selects.forEach(select => {
            select.innerHTML = '';
            SUB_STATUS_LABELS.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt;
                option.textContent = opt;
                select.appendChild(option);
            });
        });
    }

    initEchoSelect() {
        // Clear
        this.echoSelect.innerHTML = '';
        // Group by cost
        const costGroups = {};
        this.echoData.forEach(echo => {
            const cost = echo.cost || '不明';
            if (!costGroups[cost]) costGroups[cost] = [];
            costGroups[cost].push(echo);
        });
        Object.keys(costGroups).sort((a, b) => a - b).forEach(cost => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = `COST${cost}`;
            costGroups[cost].forEach(echo => {
                const option = document.createElement('option');
                option.value = echo.name;
                option.textContent = echo.name;
                optgroup.appendChild(option);
            });
            this.echoSelect.appendChild(optgroup);
        });
    }

    setEchoByName(echoName) {
        // Try exact match, else closest
        let found = false;
        for (const option of this.echoSelect.querySelectorAll('option')) {
            if (option.value === echoName) {
                option.selected = true;
                found = true;
                break;
            }
        }
        if (!found) {
            // Fuzzy match
            let bestScore = 0, bestOption = null;
            for (const option of this.echoSelect.querySelectorAll('option')) {
                const score = this.similarity(echoName, option.value);
                if (score > bestScore) {
                    bestScore = score;
                    bestOption = option;
                }
            }
            if (bestOption) bestOption.selected = true;
        }
        // this.updateMainOption2();
        // this.updateMainOption2Value();
    }

    setMainStatus(mainStatus) {
        // Set paramName
        this.setSelectByLabel(this.mainOption1, mainStatus.paramName1, MAIN_STATUS_1_LABELS);
        // Set value
        this.mainOption1Value.value = mainStatus.value1;

        // Set paramName2
        this.setSelectByLabel(this.mainOption2, mainStatus.paramName2, MAIN_STATUS_2_LABELS);
        // Set value2
        this.mainOption2Value.value = mainStatus.value2;
    }
    setSubStatus(subStatus) {
        // 既存のtr要素を取得
        const rows = Array.from(this.subStatusTable.querySelectorAll('tr'));
        for (let i = 0; i < subStatus.length; i++) {
            const sub = subStatus[i];
            let tr = rows[i];
            // selectとinputを取得
            const select = tr.querySelector('select');
            const input = tr.querySelector('input');
            // 値をセット
            this.setSelectByLabel(select, sub.paramName, SUB_STATUS_LABELS);
            input.value = sub.value;
        }
    }

    setSelectByLabel(select, label, labels) {
        // If select has no options, populate with default paramLabels
        if (select.options.length === 0) {
            labels.forEach(label => {
                const option = document.createElement('option');
                option.value = label;
                option.textContent = label;
                select.appendChild(option);
            });
        }

        // Try exact, else closest
        let found = false;
        for (const option of select.options) {
            if (option.value === label) {
                option.selected = true;
                found = true;
                break;
            }
        }
        if (!found) {
            let bestScore = 0, bestOption = null;
            for (const option of select.options) {
                const score = this.similarity(label, option.value);
                if (score > bestScore) {
                    bestScore = score;
                    bestOption = option;
                }
            }
            if (bestOption) bestOption.selected = true;
        }
    }

    similarity(a, b) {
        // Simple: ratio of matching chars in order
        let matches = 0;
        for (let i = 0; i < Math.min(a.length, b.length); i++) {
            if (a[i] === b[i]) matches++;
        }
        return matches / Math.max(a.length, b.length, 1);
    }

}


/**
 * UserCharacterModel
 * 1キャラのユーザー設定を管理するモデル（このインスタンスをキャラごとに作成する）
 */
class UserCharaModel {
    constructor({
        name = "",
        chain = 0,
        equipment = { id: "", type: "", rank: 1 },
        scoreFactorType = "default",
        scoreFactor = {
            // "クリティカル": 1.0,
            // "クリティカルダメージ": 1.0,
            // "HP": 1.0,
            // "攻撃力": 1.0,
            // "防御力": 1.0,
            // "共鳴効率": 1.0,
            // "通常攻撃ダメージアップ": 1.0,
            // "重撃ダメージアップ": 1.0,
            // "共鳴スキルダメージアップ": 1.0,
            // "共鳴解放ダメージアップ": 1.0
        },
        echoList = []
    } = {}) {
        this.name = name;
        this.chain = chain;
        this.equipment = { ...equipment };
        this.scoreFactorType = scoreFactorType;
        this.scoreFactor = { ...scoreFactor };
        // echoListはEchoModelインスタンスの配列
        this.echoList = echoList.map(e => (e instanceof EchoModel ? e : new EchoModel(e)));
    }

    setEchoList(echoList) {
        this.echoList = echoList.map(e => (e instanceof EchoModel ? e : new EchoModel(e)));
    }
    setEcho(index, echoObj) {
        if (!(echoObj instanceof EchoModel)) {
            echoObj = new EchoModel(echoObj);
        }
        this.echoList[index] = echoObj;
    }

    setScoreFactorType(type) {
        this.scoreFactorType = type;
    }

    setScoreFactor(factorObj) {
        this.scoreFactor = { ...this.scoreFactor, ...factorObj };
    }

    setWeapon(id, weaponType, rank=1) {
        this.equipment.id = id || this.equipment.id;
        this.equipment.weaponType = weaponType || this.equipment.weaponType;
        this.equipment.rank = rank || this.equipment.rank;
    }

    setChain(chain) {
        this.chain = chain;
    }

    setName(name) {
        this.name = name;
    }

    toJSON() {
        return {
            name: this.name,
            chain: this.chain,
            equipment: { ...this.equipment },
            scoreFactor: { ...this.scoreFactor },
            scoreFactorType: this.scoreFactorType,
            echoList: this.echoList.map(e => (typeof e.toJSON === "function" ? e.toJSON() : e))
        };
    }
}




/**
 * UserCharaDataManager
 * キャラクターごとのユーザーデータを管理
 * gameDataManagerのdata.resonator情報を保持（resonatorはCharacterのこと）
 * CharaSelecterと連携し、キャラが切り替わったら、そのキャラのデータを取得し、表示する
 * ユーザーがキャラを切り替えたりキャラ情報を更新したら、LocalStorageに情報を保存する
 * UserDataの構造
    {
        "selectedCharaName": "キャラ名",
        "charaData": {
            "キャラ名": {
                UserCharacterModel のインスタンスをJSON化したもの
            }
        },
        weaponData: [
            {
                id: "10011",
                rank: 1
            }
        ]
    }
 * 
 */
class UserCharaDataManager {
    constructor(charactersDB) {
        this.charactersDB = charactersDB;
        this.currentCharaModel = null;
        this.userDataLSM = new LocalStorageManager('userData');
        this.userData = this.userDataLSM.getData()
        if (this.userData.selectedCharaName === undefined) {
            this.userData.selectedCharaName = "";
        }
        if (this.userData.charaData === undefined) {
            this.userData.charaData = {};
        }
        this.subtotalScoreListView;
        this.init();
    }

    init() {
        // this.userData.selectedCharaNameがなかったら、デフォキャラを設定
        let charaName = this.userData.selectedCharaName;
        if (!charaName) {
            charaName = "漂泊者・回折"
            this.userData.selectedCharaName = charaName;
        }
        const currentCharaDB = this.getCurrentCharaDB();
        let userCharaData = this.userData.charaData[charaName];

        // userCharaData をセットアップ
        if (!userCharaData){
            userCharaData = {
                name: charaName,
                equipment: {
                    id: this.getWeaponDefaultId(currentCharaDB.weaponType),
                    type: currentCharaDB.weaponType || "",
                    rank: 1
                },
                scoreFactor: currentCharaDB.scoreWeight || {},
                scoreFactorType: "default",
                echoList: []
            }
        }
        let scoreWeight = currentCharaDB.scoreWeight;
        if (typeof scoreWeight === "string") {
            try {
            scoreWeight = JSON.parse(scoreWeight);
            } catch (e) {
            scoreWeight = {};
            }
        }
        this.currentCharaModel = new UserCharaModel(userCharaData);

        // Userキャラデータをもとに、表示を更新
        this.setSelectedChara(charaName);
        const {id, weaponType, rank} = this.currentCharaModel.equipment;
        this.setWeaponData(id, weaponType, rank);

    }

    getCurrentCharaDB() {
        const charaName = this.userData.selectedCharaName;
        return this.charactersDB.find(c => c.name === charaName);
    }

    getCurrentUserCharaData() {
        const charaName = this.userData.selectedCharaName;
        return this.userData.charaData[charaName] || {};
    }

    getWeaponDefaultId(weaponType){
        return Number("210" + weaponType + "0011");
    }

    setSelectedChara(name) {
        // nameが一致するキャラがresonator配列に存在するかチェック
        const exists = this.charactersDB.some(chara => chara.name === name);
        if (!exists) return;

        // userDataのselectedCharaを更新
        this.userData.selectedCharaName = name;

        // charaDataに選択キャラがいるか探す
        if (this.userData.charaData[name]) {
            // 既存データがあればUserCharaModelインスタンス化して格納
            this.currentCharaModel = new UserCharaModel(this.userData.charaData[name]);
        }
        else {
            // なければ新規作成
            this.currentCharaModel = new UserCharaModel({ name: name });
            this.userData.charaData[name] = this.currentCharaModel.toJSON();
        }
        if (!this.currentCharaModel.equipment.weaponType) {
            this.currentCharaModel.equipment.weaponType = this.getCurrentCharaDB().weaponType;
            this.userData.charaData[name] = this.currentCharaModel.toJSON();
        }
        
        // LocalStorageとSync
        this.userDataLSM.setData(this.userData);
    }

    getEchoList() {
        return this.currentCharaModel.echoList;
    }
    
    setEchoList(echoList) {
        this.currentCharaModel.setEchoList(echoList);
        this._syncUserDataLSM();
    }

    setEcho(index, echoObj) {
        this.currentCharaModel.setEcho(index, echoObj);
        this._syncUserDataLSM();
    }

    setScoreFactorType(type) {
        this.currentCharaModel.setScoreFactorType(type);
        this._syncUserDataLSM();
    }

    setScoreFactor(factorObj) {
        this.currentCharaModel.setScoreFactor(factorObj);
        this._syncUserDataLSM();
    }

    setWeaponData(id, weaponType, rank) {
        rank = rank || this.currentCharaModel.equipment.rank || 1;
        this.currentCharaModel.setWeapon(id, weaponType, rank);
        this._syncUserDataLSM();
    }

    setChain(chain) {
        this.currentCharaModel.setChain(chain);
        this._syncUserDataLSM();
    }

    setName(name) {
        this.currentCharaModel.setName(name);
        this._syncUserDataLSM();
    }

    // 内部: selectedCharaModel→userData→LocalStorageへ反映
    _syncUserDataLSM() {
        const name = this.currentCharaModel.name;
        this.userData.charaData[name] = this.currentCharaModel.toJSON();
        this.userDataLSM.setData(this.userData);
    }
}








/**
 * EchoModel
 * Echo（エコー）1つ分のデータモデル
 */
class EchoModel {
    constructor({
        id = "",
        name = "",
        elementType = "",
        cost = "",
        mainStatus1 = { propertyName: "", value: "" },
        mainStatus2 = { propertyName: "", value: "" },
        subStatus = Array(5).fill().map(() => ({ propertyName: "", value: "" }))
    } = {}) {
        this.id = id;
        this.name = name;
        this.elementType = elementType;
        this.cost = cost;

        this.setMainStatus1(mainStatus1);
        this.mainStatus2 = { ...mainStatus2 };
        this.setSubStatus(subStatus);
    }

    // mainStatus1 value: if ends with ".0%" → remove ".0"
    _normalizeMainStatus1(mainStatus1) {
        let ms1Value = mainStatus1.value;
        if (typeof ms1Value === "string" && ms1Value.match(/^\d+\.0%$/)) {
            ms1Value = ms1Value.replace(/\.0%$/, "%");
        }
        return { ...mainStatus1, value: ms1Value };
    }

    // subStatus value: if ends with "%" and no decimal, add ".0"
    _normalizeSubStatus(subStatus) {
        return subStatus.map(s => {
            let v = s.value;
            if (
                typeof v === "string" &&
                v.match(/^\d+%$/)
            ) {
                v = v.replace(/%$/, ".0%");
            }
            return { ...s, value: v };
        });
    }

    setMainStatus1(val) {
        this.mainStatus1 = this._normalizeMainStatus1(val);
    }

    setSubStatus(val) {
        this.subStatus = this._normalizeSubStatus(val);
    }

    /**
     * データの自己チェック
     * @returns {object} エラー情報 { valid: boolean, errors: array }
     */
    selfCheck() {
        const errors = [];

        // mainStatus1
        if (!MAIN_STATUS_1_LABELS.includes(this.mainStatus1.propertyName)) {
            errors.push(`mainStatus1.propertyName "${this.mainStatus1.propertyName}" is invalid`);
        }
        // mainStatus2
        if (!MAIN_STATUS_2_LABELS.includes(this.mainStatus2.propertyName)) {
            errors.push(`mainStatus2.propertyName "${this.mainStatus2.propertyName}" is invalid`);
        }
        // subStatus
        this.subStatus.forEach((s, i) => {
            if (!SUB_STATUS_LABELS.includes(s.propertyName)) {
                errors.push(`subStatus[${i}].propertyName "${s.propertyName}" is invalid`);
            }
        });

        return {
            valid: errors.length === 0,
            errors
        };
    }
}

/**
 * EchoListManager
 * echo-list の各echo情報を管理し、UI編集・反映も担当
 * echoList は以下の形式で保持
   [
        {
            id: "H71",
            name: "ナイトメア・飛廉の大猿"
            elementType: "Wind",
            cost: "4",
            mainStatus1: {propertyName: "クリティカル", value: "22%"},
            mainStatus2: {propertyName: "攻撃力", value: "150"},
            subStatus: [
                {propertyName: "クリティカル", value: "10.5%"},
                {propertyName: "クリティカル", value: "10.5%"},
                {propertyName: "クリティカル", value: "10.5%"},
                {propertyName: "クリティカル", value: "10.5%"},
                {propertyName: "クリティカル", value: "10.5%"}
            ]
        }
    ]
 */
class EchoListManager {
    constructor(echoDB, echoScoreCalculator) {
        this.echoDB = echoDB || [];
        this.echoList = [];
        this.ul = document.getElementById('echo-list');
        this.lis = this.ul.querySelectorAll('li');
        this.echoScoreCalculator = echoScoreCalculator || new EchoScoreCalculator();
        this.init();
    }

    init() {
        // 初期化時にecho-listのli数だけ空データを用意
        this.echoList = Array.from(this.lis).map(() => new EchoModel());
        // 編集用selectを生成
        this.mainStatus1Select = this.createSelect(MAIN_STATUS_1_LABELS);
        this.mainStatus2Select = this.createSelect(MAIN_STATUS_2_LABELS);
        this.subStatusSelect = this.createSelect(SUB_STATUS_LABELS);
        // イベント付与
        this.attachEditEvents();
    }

    createSelect(labels) {
        const select = document.createElement('select');
        labels.forEach(label => {
            const option = document.createElement('option');
            option.value = label;
            option.textContent = label;
            select.appendChild(option);
        });
        select.style.position = 'absolute';
        select.style.minWidth = '120px';
        return select;
    }

    // 編集イベント付与
    attachEditEvents() {
        const lis = this.ul.querySelectorAll('li');
        lis.forEach((li, slotIndex) => {
            // main-status th
            const mainThs = li.querySelectorAll('.main-status th');
            mainThs.forEach((th, thIndex) => {
                th.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.showMainStatusSelect(th, slotIndex, thIndex);
                });
            });
            // main-status td
            const mainTds = li.querySelectorAll('.main-status td');
            mainTds.forEach((td, tdIndex) => {
                td.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.showEditInput(td, slotIndex, tdIndex, 'main');
                });
            });
            // sub-status th
            const subThs = li.querySelectorAll('.sub-status tbody th');
            console.log('subThs:', subThs);
            subThs.forEach((th, subIndex) => {
                th.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.showSubStatusSelect(th, slotIndex, subIndex);
                });
            });
            // sub-status td
            const subTrs = li.querySelectorAll('.sub-status tbody tr');
            subTrs.forEach((tr, subIndex) => {
                // 編集対象は最初のtdのみ（Scoreのtdを除外）
                const td = tr.querySelector('td');
                td.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.showEditInput(td, slotIndex, subIndex, 'sub');
                });
            });
        });
    }

    // main-status th編集
    showMainStatusSelect(th, slotIndex, thIndex) {
        const select = thIndex === 0 ? this.mainStatus1Select : this.mainStatus2Select;
        // 選択値をセット
        select.value = th.textContent.trim();
        // DOM配置
        const originalValue = select.value;
        th.textContent = '';
        th.appendChild(select);
        select.focus();
        select.size = 6; // プルダウン展開

        const closeEdit = (val) => {
            th.textContent = val;
            select.removeEventListener('change', onBlurOrChange);
            select.removeEventListener('blur', onBlurOrChange);
            select.removeEventListener('keydown', onKeyDown);
            select.size = 1;
            
            if (originalValue !== val) {
                if (thIndex === 0) {
                    this.echoList[slotIndex].mainStatus1.propertyName = val;
                } else {
                    this.echoList[slotIndex].mainStatus2.propertyName = val;
                }
                this.fireEchoListChanged();
            }
        };

        let isChanged = false;
        const onBlurOrChange = () => {
            if (isChanged) return;
            isChanged = true;
            closeEdit(select.value);
        };

        const onKeyDown = (e) => {
            if (e.key === 'Escape' || e.key === 'Esc') {
                closeEdit(originalValue);
            }
        };

        select.addEventListener('change', onBlurOrChange, { once: true });
        select.addEventListener('blur', onBlurOrChange, { once: true });
        select.addEventListener('keydown', onKeyDown);
    }

    // sub-status th編集
    showSubStatusSelect(th, slotIndex, thIndex) {
        const select = this.subStatusSelect;
        select.value = th.textContent.trim();
        const originalValue = select.value;
        th.textContent = '';
        th.appendChild(select);
        select.focus();
        select.size = 6;

        const closeEdit = (val) => {
            th.textContent = val;
            select.removeEventListener('change', onBlurOrChange);
            select.removeEventListener('blur', onBlurOrChange);
            select.removeEventListener('keydown', onKeyDown);
            select.size = 1;
            
            if (originalValue !== val) {
                this.echoList[slotIndex].subStatus[thIndex].propertyName = val;

                // スコア計算
                this.calcEchoScore(slotIndex);
                this.fireEchoListChanged();
            }
        };

        let isChanged = false;
        const onBlurOrChange = () => {
            if (isChanged) return;
            isChanged = true;
            closeEdit(select.value);
        };

        const onKeyDown = (e) => {
            if (e.key === 'Escape' || e.key === 'Esc') {
                closeEdit(originalValue);
            }
        };

        select.addEventListener('change', onBlurOrChange, { once: true });
        select.addEventListener('blur', onBlurOrChange, { once: true });
        select.addEventListener('keydown', onKeyDown);
    }

    // td編集
    showEditInput(td, slotIndex, tdIndex, type) {
        const originalValue = td.textContent.trim();
        td.textContent = '';
        // 新しいinput要素を毎回生成して使う（多重編集バグ防止）
        const input = document.createElement('input');
        input.type = 'text';
        input.value = originalValue;
        td.appendChild(input);
        input.focus();
        input.select();

        const closeEdit = (val) => {
            // tdとechoListに反映
            td.textContent = val;
            // イベント削除とinput要素の削除
            input.removeEventListener('change', onBlurOrChange);
            input.removeEventListener('blur', onBlurOrChange);
            input.removeEventListener('keydown', onKeyDown);
            input.remove();
            
            if (originalValue !== val) {
                if (type === 'main') {
                    if (tdIndex === 0) this.echoList[slotIndex].mainStatus1.value = val;
                    else this.echoList[slotIndex].mainStatus2.value = val;
                }
                else {
                    this.echoList[slotIndex].subStatus[tdIndex].value = val;
                }

                this.calcEchoScore(slotIndex);
                this.fireEchoListChanged();
            }
        };

        let isChanged = false;
        const onBlurOrChange = () => {
            if (isChanged) return;
            isChanged = true;
            let val = input.value;
            // 全角数字・ドット・％→半角
            val = val.replace(/[０-９．．]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
                .replace(/[％]/g, '%');
            // 数字と.と%以外除去
            val = val.replace(/[^0-9.%\-]/g, '');
            if (!val) val = originalValue;
            closeEdit(val);
        };

        const onKeyDown = (e) => {
            if (e.key === 'Escape' || e.key === 'Esc') {
                closeEdit(originalValue);
            }
        };

        input.addEventListener('change', onBlurOrChange, { once: true });
        input.addEventListener('blur', onBlurOrChange, { once: true });
        input.addEventListener('keydown', onKeyDown);
        input.addEventListener('click', (e) => e.stopPropagation());
    }

    // echoListChangedイベント発火
    fireEchoListChanged() {
        const event = new CustomEvent('echoListChanged', { detail: { echoList: this.getEchoList() } });
        document.dispatchEvent(event);
    }

    setEchoList(echoList) {
        // echoListはEchoModelインスタンスの配列
        this.echoList = echoList.map(e => (e instanceof EchoModel ? e : new EchoModel(e)));
    }


    // データ取得
    getEchoList() {
        return this.echoList;
    }

    calcEchoScore(slotIndex) {
        // sub-statusスコア計算・出力
        const li = this.lis[slotIndex];
        const subStatusTbody = li.querySelector('.sub-status tbody');
        const subTrs = subStatusTbody.querySelectorAll('tr');
        let totalScore = 0;
        for (let i = 0; i < subTrs.length; i++) {
            const th = subTrs[i].querySelector('th');
            const tds = subTrs[i].querySelectorAll('td');
            if (tds.length > 1) {
                const score = parseFloat(this.echoScoreCalculator.calc(th, tds[0], tds[1]));
                if (!isNaN(score)){
                    totalScore += score;
                    // scoreが0ならdisabledクラスを付与、0以外なら外す
                    subTrs[i].classList.toggle('disabled', score === 0);
                }
            }
        }
        // 合計値をli .score bに出力（小数点第一位まで）
        const scoreElem = li.querySelector('.score b');
        if (scoreElem) {
            scoreElem.textContent = totalScore.toFixed(1);
        }
    }
    calcEchoScoreAll() {
        // 全てのechoのスコアを計算
        this.lis.forEach((li, index) => {
            this.calcEchoScore(index);
        });
    }

    // データ上書き
    setEcho(slotIndex, echoObj) {
        // // echoObjがEchoModelでなければ変換
        // if (!(echoObj instanceof EchoModel)) {
        //     echoObj = new EchoModel(echoObj);
        // }
        this.echoList[slotIndex] = echoObj;
        this.renderEcho(slotIndex, echoObj);
        this.calcEchoScore(slotIndex);

        const event = new CustomEvent('updatEchoSlot', { detail: { echoList: this.getEchoList() } });
        document.dispatchEvent(event);
    }

    setEchoList(echoList) {
        echoList = Array(5).fill().map((_, i) => echoList[i] ? echoList[i] : new EchoModel());
        echoList.forEach((echo, index) => {
            this.setEcho(index, echo);
        });
    }

    // UI反映
    renderEcho(slotIndex, echo) {
        let li;
        if (slotIndex === -1){
            li = this.ul.querySelector('li').cloneNode(true);
            li.id = 'drag-echo-item';
            li.classList.add('highlight');
        }
        else{
            li = this.ul.querySelectorAll('li')[slotIndex];
        }

        // 画像
        const img = li.querySelector('figure img');
        if (echo.id && echo.cost) {
            img.src = `./img/common/echo/cost${echo.cost}/${echo.id}.webp`;
        }
        else {
            img.src = DUMMYURI;
        }

        // cost
        const costDiv = li.querySelector('.cost');
        costDiv.textContent = echo.cost || '';

        // main-status
        const mainStatusTable = li.querySelector('.main-status');
        const trs = mainStatusTable.querySelectorAll('tr');
        trs[0].querySelector('th').textContent = echo.mainStatus1.propertyName || '';
        trs[0].querySelector('td').textContent = echo.mainStatus1.value || '';
        trs[1].querySelector('th').textContent = echo.mainStatus2.propertyName || '';
        trs[1].querySelector('td').textContent = echo.mainStatus2.value || '';

        // sub-status
        const subStatusTbody = li.querySelector('.sub-status tbody');
        const subTrs = subStatusTbody.querySelectorAll('tr');
        for (let i = 0; i < subTrs.length; i++) {
            // 1つ目のtdのみ編集反映
            subTrs[i].querySelector('th').textContent = echo.subStatus[i]?.propertyName || '';
            const tds = subTrs[i].querySelectorAll('td');
            if (tds.length > 0) {
                tds[0].textContent = echo.subStatus[i]?.value || '';
            }
            // 2つ目以降のtdは編集反映しない
        }
        return li;
    }

    // OCR結果反映
    updateFromOcr(ocrResult, slotIndex = 0) {
        // ocrResultはEchoModelインスタンス前提
        if (!(ocrResult instanceof EchoModel)) return;

        // echoDataから一致するものを探して不足情報を補完
        let echoObj = this.echoDB.find(e => e.name === ocrResult.name);

        if (echoObj) {
            ocrResult.id = echoObj.id;
            ocrResult.name = echoObj.name;
            // ocrResult.elementType = echoObj.element;
            ocrResult.cost = echoObj.cost;
        }

        // slotIndex === -1 の場合はドラッグ＆ドロップUIで適用スロットを選ばせる
        if (slotIndex === -1) {
            this.slotSelectUI(ocrResult);
            return;
        }

        this.setEcho(slotIndex, ocrResult);

    }
    slotSelectUI(ocrResult){
        // liを生成
        const dragLi = this.renderEcho(-1, ocrResult);

        // #echo-listの中央・上側に配置
        const echoListRect = this.ul.getBoundingClientRect();
        const liSample = this.ul.querySelector('li');
        const liRect = liSample.getBoundingClientRect();
        dragLi.style.left = (echoListRect.left + (echoListRect.width - liRect.width) / 2) + 'px';
        dragLi.style.top = (echoListRect.top - liRect.height - 20) + 'px';

        // body直下に配置
        document.body.appendChild(dragLi);

        // ドラッグ制御
        let offsetX = 0, offsetY = 0, dragging = false;

        const onMouseDown = (e) => {
        dragging = true;
        dragLi.style.cursor = 'grabbing';
        offsetX = e.clientX - dragLi.getBoundingClientRect().left;
        offsetY = e.clientY - dragLi.getBoundingClientRect().top;
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        };

        const onMouseMove = (e) => {
        if (!dragging) return;
        dragLi.style.left = (e.clientX - offsetX) + 'px';
        dragLi.style.top = (e.clientY - offsetY) + 'px';

        // highlight処理
        let foundHighlight = false;
        this.lis.forEach((li, idx) => {
            const rect = li.getBoundingClientRect();
            if (
            e.clientX >= rect.left &&
            e.clientX <= rect.right &&
            e.clientY >= rect.top &&
            e.clientY <= rect.bottom
            ) {
            li.classList.add('highlight');
            foundHighlight = true;
            } else {
            li.classList.remove('highlight');
            }
        });
        if (!foundHighlight) {
            this.lis.forEach(li => li.classList.remove('highlight'));
        }
        };

        const onMouseUp = (e) => {
        dragging = false;
        dragLi.style.cursor = 'grab';
        let dropped = false;
        this.lis.forEach((li, idx) => {
            const rect = li.getBoundingClientRect();
            if (
            e.clientX >= rect.left &&
            e.clientX <= rect.right &&
            e.clientY >= rect.top &&
            e.clientY <= rect.bottom
            ) {
            li.classList.remove('highlight');
            dragLi.remove();
            this.setEcho(idx, ocrResult);
            dropped = true;
            } else {
            li.classList.remove('highlight');
            }
        });
        if (dropped) {
            dragLi.remove();
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }
        };

        dragLi.addEventListener('mousedown', onMouseDown);
        // タッチ対応
        dragLi.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        dragging = true;
        dragLi.style.cursor = 'grabbing';
        offsetX = touch.clientX - dragLi.getBoundingClientRect().left;
        offsetY = touch.clientY - dragLi.getBoundingClientRect().top;
        const onTouchMove = (ev) => {
            const t = ev.touches[0];
            dragLi.style.left = (t.clientX - offsetX) + 'px';
            dragLi.style.top = (t.clientY - offsetY) + 'px';
            let foundHighlight = false;
            this.lis.forEach((li, idx) => {
            const rect = li.getBoundingClientRect();
            if (
                t.clientX >= rect.left &&
                t.clientX <= rect.right &&
                t.clientY >= rect.top &&
                t.clientY <= rect.bottom
            ) {
                li.classList.add('highlight');
                foundHighlight = true;
            } else {
                li.classList.remove('highlight');
            }
            });
            if (!foundHighlight) {
            this.lis.forEach(li => li.classList.remove('highlight'));
            }
        };
        const onTouchEnd = (ev) => {
            dragging = false;
            dragLi.style.cursor = 'grab';
            let dropped = false;
            const changedTouch = ev.changedTouches[0];
            this.lis.forEach((li, idx) => {
                const rect = li.getBoundingClientRect();
                if (
                    changedTouch.clientX >= rect.left &&
                    changedTouch.clientX <= rect.right &&
                    changedTouch.clientY >= rect.top &&
                    changedTouch.clientY <= rect.bottom
                ) {
                    li.classList.remove('highlight');
                    dragLi.remove();
                    this.setEcho(idx, ocrResult);
                    dropped = true;
                } else {
                    li.classList.remove('highlight');
                }
            });
            if (!dropped) {
                dragLi.remove();
            }
            document.removeEventListener('touchmove', onTouchMove);
            document.removeEventListener('touchend', onTouchEnd);

        };
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', onTouchEnd, { passive: false });
        }, { passive: false });
    }
}


class WWScore{
    constructor(dataBase) {
        this.dataBase = dataBase;
        this.userCharaDataManager = new UserCharaDataManager(dataBase.resonator);
        this.echoListManager = new EchoListManager(dataBase.echo);
        this.ocrWindowController = new OCRWindowController()

        this.charaSeceter = new CharaSelecter();
        this.weaponSelecter = new WeaponSelecter();
        this.subtotalListManager = new SubtotalListManager();
        
        this.init();
    }

    init() {
        this.applyUserData();
        this.observeOCR();
        this.observeCharaChange();
        this.observeWeaponChange();
        this.observeFactorChange();
        this.observeEchoStatusChange();
    }
    applyUserData() {
        const selectedCharaName = this.userCharaDataManager.userData.selectedCharaName;
        this.changeChara(selectedCharaName || "漂泊者・回折");
    }
    changeChara(charaName) {
        this.userCharaDataManager.setSelectedChara(charaName);
        this.updateCharaView()
        this.updateWeapon();
        this.updateScoreFactor();
        this.updateEchoList();
    }
    updateCharaView(){
        // charaDBを取得してsetSelectedCharacterに渡す
        const charaDB = this.userCharaDataManager.getCurrentCharaDB()
        if (charaDB) {
            this.charaSeceter.setSelectedCharacter(charaDB);
        }
    }

    updateWeapon() {
        // selectedCharaModelのweaponを取得
        const equipmentData = this.userCharaDataManager.currentCharaModel.equipment;

        // TODO: これ多分不要になるので、あとで確認して削除
        if (!equipmentData.id) {
            equipmentData.id = this.userCharaDataManager.getWeaponDefaultId(equipmentData.weaponType);
        }
        this.weaponSelecter.setSelectedWeaponById(equipmentData.id, equipmentData.rank);
        this.weaponSelecter.tabSelecterModalView.isolate(WEAPON_TYPES["ja"][equipmentData.weaponType - 1]);

        const charaAtk = this.userCharaDataManager.getCurrentCharaDB().baseATK;
        const weaponAtk = this.weaponSelecter.weaponTable.querySelector('td').textContent.trim();
        this.charaSeceter.atkInput.value = Number(charaAtk) + Number(weaponAtk);
        this.charaSeceter.atkInput.parentNode.dataset.breakdown = `${charaAtk}+${weaponAtk}`;
    }
    updateScoreFactor() {
        const getCurrentUserCharaData = this.userCharaDataManager.getCurrentUserCharaData();
        this.subtotalScoreListView = new SubtotalScoreListView(
            this.userCharaDataManager.getCurrentCharaDB().scoreWeight,
            getCurrentUserCharaData.scoreFactor,
            getCurrentUserCharaData.scoreFactorType
        );
        this.subtotalScoreListView.setFactors()
    }

    updateEchoList() {
        this.echoListManager.setEchoList(this.userCharaDataManager.getEchoList());
        this.subtotalListManager.update();
    }
    observeOCR(){
        // OCRWindowControllerのイベントを監視して、echoListManagerに反映
        document.addEventListener('loadedOCR', (e) => {
            const { ocrResult, slotIndex } = e.detail;
            this.echoListManager.updateFromOcr(ocrResult, slotIndex);
        });

        // UserDataの現在のキャラのechoListを更新
        document.addEventListener('updatEchoSlot', (e) => {
            this.userCharaDataManager.setEchoList(e.detail.echoList);
            
            this.subtotalListManager.update();
            this.echoListManager.calcEchoScoreAll();
        });
    }
    observeCharaChange() {
        // UserCharaDataManagerのキャラ切り替えイベントを監視
        document.addEventListener('characterChanged', (e) => {
            const charaDB = e.detail;

            // 既に選択されているキャラクターの場合は処理をスキップ
            if (this.userCharaDataManager.userData.selectedCharaName === charaDB.name) {
                return;
            }
            this.changeChara(charaDB.name);
        });
    }
    observeWeaponChange() {
        document.addEventListener('weaponChanged', (e) => {
            const {id, weaponType} = e.detail;
            if (this.userCharaDataManager.currentCharaModel.equipment.id === id) {
                return; // 既に選択されている武器の場合は処理をスキップ
            }
            this.userCharaDataManager.setWeaponData(id, weaponType);
            this.updateWeapon();
            this.updateEchoList();
        });
        document.addEventListener('syntonizeChanged', (e) => {
            const {id, weaponType, rank} = e.detail;
            if (this.userCharaDataManager.currentCharaModel.equipment.rank === rank) {
                return; // 既に選択されている武器の場合は処理をスキップ
            }
            this.userCharaDataManager.setWeaponData(id, weaponType, rank);
            // this.updateWeapon();
            // this.updateEchoList();
        });
    }
    observeFactorChange() {
        this.subtotalScoreListView.onFactorChange(() => {
            this.subtotalListManager.update();
            this.userCharaDataManager.setScoreFactor(this.subtotalScoreListView.getFactors());
            this.echoListManager.calcEchoScoreAll();
        });

        
        this.subtotalScoreListView.onTypeChange((type) => {
            this.subtotalListManager.update();
            this.userCharaDataManager.setScoreFactorType(type);
            this.echoListManager.calcEchoScoreAll();
        });
    }
    observeEchoStatusChange() {
        // echoListManagerのechoListChangedイベントを監視
        document.addEventListener('echoListChanged', (e) => {
            const echoList = e.detail.echoList;
            this.userCharaDataManager.setEchoList(echoList);
            this.subtotalListManager.update();
            this.echoListManager.calcEchoScoreAll();
        });
    }
}

gameDataManager.loadData((data) => {
    new WWScore(data);
});
