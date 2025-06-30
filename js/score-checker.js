import Tesseract from "https://cdn.jsdelivr.net/npm/tesseract.js@6/dist/tesseract.esm.min.js";


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
}


class CharaSelecter {
    constructor() {
        this.selectedCharacterFigure = document.getElementById('selected-character-figure');
        this.selectedCharacterImg = this.selectedCharacterFigure.querySelector('img');
        this.selectedCharacterName = document.querySelector('#chara-name b');
        this.selectedCharacterElementType = document.querySelector('#chara-name img');
        this.charaChangeButton = document.getElementById('chara-change-button');
        this.charaSelecterWindow = document.getElementById('chara-selecter-window');
        this.tabs = this.charaSelecterWindow.querySelectorAll('.tab button');
        this.charactersContainer = document.getElementById('characters');
        this.closePopupButton = document.getElementById('close-popup');
        this.init();
    }

    init() {
        this.populateCharacterList();
        this.addEventListeners();
    }

    populateCharacterList() {
        let charaData = gameDataManager.getCharacterData();
        charaData.sort((a, b) => {
            if (b.rarity !== a.rarity) return b.rarity - a.rarity;
            return a.kana.localeCompare(b.kana);
        });

        this.charactersContainer.innerHTML = ''; // Clear previous characters

        const ulElement = document.createElement('ul');

        charaData.forEach(character => {
            const liElement = document.createElement('li');
            liElement.className = 'character-item';
            liElement.dataset.attribute = character.element; // Store attribute for filtering

            const src = ImageUtil.getCharaImagePath(character, 'thumb');
            liElement.innerHTML = `<img
                class="character-img" width="128" height="128"
                alt="${character.name}" src="${src}">`;


            // const nameElement = document.createElement('p');
            // nameElement.textContent = `名前: ${character.name}`;
            // liElement.appendChild(nameElement);

            // const attributeElement = document.createElement('p');
            // attributeElement.textContent = `属性: ${character.element}`;
            // liElement.appendChild(attributeElement);

            liElement.addEventListener('click', () => {
                this.setSelectedCharacter(character);
            });

            ulElement.appendChild(liElement);
        });

        this.charactersContainer.appendChild(ulElement);
    }

    setSelectedCharacter(character) {
        this.selectedCharacterElementType.src = `./img/common/icons/elements/${character.elementEn}.webp`;
        this.selectedCharacterName.textContent = character.name;
        this.selectedCharacterImg.src = ImageUtil.getCharaImagePath(character, 'profile');
        this.charaSelecterWindow.style.display = 'none';
    }

    addEventListeners() {
        this.charaChangeButton.addEventListener('click', () => {
            this.charaSelecterWindow.style.display = 'block';
        });

        this.closePopupButton.addEventListener('click', () => {
            this.charaSelecterWindow.style.display = 'none';
        });

        this.tabs.forEach((tab, index) => {
            if (index === 0) {
                tab.classList.add('active');
                this.filterCharacters(tab.dataset.attribute);
            }

            tab.addEventListener('click', () => {
                this.tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.filterCharacters(tab.dataset.attribute);
            });
        });

        // Add Esc key event to close the window
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' || e.key === 'Esc') {
                if (this.charaSelecterWindow.style.display === 'block') {
                    this.charaSelecterWindow.style.display = 'none';
                }
            }
        });
    }

    filterCharacters(attribute) {
        const characterItems = this.charactersContainer.querySelectorAll('.character-item');

        characterItems.forEach(item => {
            item.style.display = 'none';
        });

        characterItems.forEach(item => {
            if (item.dataset.attribute === attribute || attribute === 'all') {
                item.style.display = 'block';
            }
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


class OCRWindow {
    constructor(ocrResultCallback) {
        this.ocrResultCallback = ocrResultCallback || (() => {});
        this.imgData = null;
        this.ocrWindow = document.getElementById('echo-scan-window');
        this.pasteArea = document.getElementById('ocr-paste-area');
        this.calcScoreButton = document.getElementById('calc-score-button');
        this.resultTextArea = document.getElementById('ocr-result-textarea');
        this.closeBtn = document.getElementById('close-ocr-window');
        this.matchedEchoThumb = document.getElementById('matched-echo-thumb');
        this.reloadBtn = document.createElement('button');
        this.blurControl = this.createSlider('ぼかし: ', 0, 5, 0.5, 0.0);
        this.sharpControl = this.createSlider('エッジ強調: ', 0, 5, 0.5, 0.0);
        this.contrastControl = this.createSlider('コントラスト: ', -100, 100, 1, 0);

        this.init();
    }

    init() {
        this.setupControls();
        this.addEventListeners();
    }

    // calcScore() {
    //     /*

    //     1. OCRWindow を閉じる
    //     2. 
    //     */
    // }

    setupControls() {
        this.reloadBtn.innerText = '再読み込み';
        this.reloadBtn.style.margin = '8px 0';

        this.ocrWindow.appendChild(this.blurControl.wrapper);
        this.ocrWindow.appendChild(this.sharpControl.wrapper);
        this.ocrWindow.appendChild(this.contrastControl.wrapper);
        this.ocrWindow.appendChild(this.reloadBtn);

        document.body.appendChild(this.ocrWindow);
    }

    addEventListeners() {
        this.closeBtn.onclick = () => this.ocrWindow.style.display = 'none';
        this.pasteArea.addEventListener('paste', (e) => {
            this.handlePaste(e)
            // console.log('OCRWindow: Paste event detected', e.target);
        });
        this.reloadBtn.onclick = () => this.applyFiltersAndOCR();
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

    handlePaste(event) {
        const items = event.clipboardData.items;
        this.ocrWindow.style.display = 'block'; 
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                const reader = new FileReader();
                reader.onload = (ev) => {
                    this.imgData = ev.target.result;
                    this.applyFiltersAndOCR();
                };
                reader.readAsDataURL(file);
                break;
            }
        }
    }
    applyFiltersAndOCR() {
        const self = this;
        if (!this.imgData) return;

        const img = new Image();
        img.onload = () => {
            let sx = 0, sy = 0, sw = img.width, sh = img.height;

            // 幅が1000pxを超える場合、左下の1体分だけ切り出し
            const isLarge = img.width > 1000;
            if (isLarge) {
                // 画像から音骸特定 ---------------------------------------
                // Echo画像切り出し・類似画像検索
                this.showEchoCropAndMatchUI(img);
                

                // フィルター処理  ---------------------------------------
                // 1枚目のデフォルト値
                const defaults = {
                    swRate: 0.163,
                    shRate: 0.3,
                    sxRate: 0.033,
                    syRate: 0.03
                };
                // Debug Tool の inputをまとめて生成
                if (!this.cropInputsAppended) {
                    ['swRate', 'shRate', 'sxRate', 'syRate'].forEach(key => {
                        const wrapper = document.createElement('div');
                        wrapper.style.marginBottom = '4px';
                        wrapper.innerHTML = `<label>${key}</label>
                            <input type="number" value="${defaults[key]}" min="0.01" max="1" step="0.001" style="width:60px;margin-left:8px;">`;
                        this.ocrWindow.appendChild(wrapper);
                        this[key + 'Input'] = wrapper.querySelector('input');
                        this[key + 'Input'].onchange = () => this.applyFiltersAndOCR();
                    });
                    this.cropInputsAppended = true;
                }
                // フィルターの初期値設定
                // this.blurControl.slider.value = 0;
                // this.sharpControl.slider.value = 1.5;
                // this.contrastControl.slider.value = -50;
                
                // 値取得
                const swRate = parseFloat(this.swRateInput.value);
                const shRate = parseFloat(this.shRateInput.value);
                const sxRate = parseFloat(this.sxRateInput.value);
                const syRate = parseFloat(this.syRateInput.value);

                sw = Math.floor(img.width * swRate);
                sh = Math.floor(img.height * shRate);
                sx = Math.floor(img.width * sxRate);
                sy = img.height - sh - Math.floor(img.height * syRate);
                
            }
            else{
                // this.blurControl.slider.value = 0.5;
                // this.sharpControl.slider.value = 0;
                // this.contrastControl.slider.value = 0;
            }

            // --- canvasを2倍の大きさで作成 ---
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const scale = 2;
            canvas.width = sw * scale;
            canvas.height = sh * scale;

            ctx.filter = `blur(${this.blurControl.slider.value}px)`;
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw * scale, sh * scale);  // 倍拡大して描画
            ctx.filter = 'none';
            if (isLarge) {
                ctx.fillStyle = 'rgba(0, 0, 0, 1)'; // Solid black
                ctx.fillRect(0, 0, canvas.width * 0.46, canvas.height * 0.36); // Fill top-left corner
            }

            

            let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            let data = imageData.data;
            const w = canvas.width, h = canvas.height;
            const copy = new Uint8ClampedArray(data);

            const sharp = parseFloat(this.sharpControl.slider.value);
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

            const contrast = parseFloat(this.contrastControl.slider.value);
            if (contrast !== 0) {
                const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
                for (let i = 0; i < data.length; i += 4) {
                    for (let j = 0; j < 3; j++) {
                        data[i + j] = Math.min(255, Math.max(0, factor * (data[i + j] - 128) + 128));
                    }
                }
            }
            ctx.putImageData(imageData, 0, 0);

            // --- ここから画像プレビュー表示処理 ---
            // 既存のプレビューがあれば削除
            if (this.previewImg && this.previewImg.parentNode) {
                this.previewImg.parentNode.removeChild(this.previewImg);
            }
            this.previewImg = document.createElement('img');
            this.previewImg.src = canvas.toDataURL();
            this.previewImg.alt = '加工済み画像プレビュー';
            this.previewImg.style.display = 'block';
            this.previewImg.style.margin = '10px auto';
            this.previewImg.style.maxWidth = '100%';
            this.previewImg.style.width = (sw) + 'px';
            this.previewImg.style.height = (sh) + 'px';
            console.log(sw, sh)
            // ocrWindowの先頭に挿入
            this.ocrWindow.appendChild(this.previewImg);
            // --- 画像プレビューここまで ---
            
            // --- OCR処理開始 ---
            const { createWorker } = Tesseract;
            (async () => {
                const worker = await createWorker(['eng', 'jpn']);
                const { data: { text } } = await worker.recognize(canvas, {
                    tessedit_char_blacklist: '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳０１２３４５６７８９',
                    preserve_interword_spaces: true,
                    // logger: m => console.log(m),
                    // errorHandler: err => {
                    //     self.resultTextArea.value = 'OCRエラー: ' + err.message;
                    // }
                })
                
                let cleanedText = self.cleanText(text);
                if (isLarge) {
                    cleanedText = 'NoName\nNone\n' + cleanedText;
                }
                self.resultTextArea.value = cleanedText;
                self.ocrResultCallback(new OcrParser(cleanedText).parse());
            })();

            // Tesseract.recognize(canvas, 'jpn', {
            //     logger: m => console.log(m),
            // })
            // .then(({ data: { text } }) => {
            //     text = this.cleanText(text);
            //     if (isLarge) {
            //         text = 'NoName\nNone\n' + text;
            //     }
            //     this.resultTextArea.value = text;
            //     this.ocrResultCallback(new OcrParser(text).parse());
            // })
            // .catch((err) => {
            //     this.resultTextArea.value = 'OCRエラー: ' + err.message;
            // });
        };

        img.src = this.imgData;
    }
    cleanText(text) {
        return text
            .replace(/[\u200B-\u200D\uFEFF]/g, '') // ゼロ幅文字などを除去
            .replace(/[\x00-\x09\x0B-\x0C\x0E-\x1F]/g, '') // 改行(\x0A)以外の制御文字を除去
            .replace(/(?<! ) (?! )/g, '') // 連続していない単発の空白だけ除去
            .replace(/\r\n|\r/g, '\n') // 改行コードを\nに統一
            .replace(/[ ]*\n[ ]*/g, '\n') // 改行前後の空白を除去
            .trim(); // 前後の空白・改行を除去
    }
    showEchoCropAndMatchUI(img) {
        // img: HTMLImageElement (ペースト画像)
        // まずimgからcanvasを作成
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const echoImgDir = './img/common/echo/';
        // プレビュー画像を保持
        if (!this.echoCropPreviewImg) {
            this.echoCropPreviewImg = document.createElement('img');
            this.echoCropPreviewImg.alt = 'Echo Crop Preview';
            this.echoCropPreviewImg.style.display = 'block';
            this.echoCropPreviewImg.style.margin = '10px auto';
            this.echoCropPreviewImg.style.maxWidth = '100%';
            this.ocrWindow.appendChild(this.echoCropPreviewImg);
        }

        // Always define a default updateEchoCropPreview function to avoid errors
        this.updateEchoCropPreview = (canvasRef) => {
            // Default: just update the preview image
            const cropX = this.echoCropInputs && this.echoCropInputs.x ? parseInt(this.echoCropInputs.x.value, 10) || 0 : 0;
            const cropY = this.echoCropInputs && this.echoCropInputs.y ? parseInt(this.echoCropInputs.y.value, 10) || 0 : 0;
            const cropW = this.echoCropInputs && this.echoCropInputs.w ? parseInt(this.echoCropInputs.w.value, 10) || canvasRef.width : canvasRef.width;
            const cropH = this.echoCropInputs && this.echoCropInputs.h ? parseInt(this.echoCropInputs.h.value, 10) || canvasRef.height : canvasRef.height;

            const echoCropCanvas = document.createElement('canvas');
            echoCropCanvas.width = cropW;
            echoCropCanvas.height = cropH;
            echoCropCanvas.getContext('2d').drawImage(canvasRef, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

            this.echoCropPreviewImg.src = echoCropCanvas.toDataURL();
        };

        if (!this.echoCropInputsAppended) {
            // UI for echo crop
            const echoCropWrapper = document.createElement('div');
            echoCropWrapper.style.margin = '8px 0';
            echoCropWrapper.innerHTML = `
                <label>Echo画像切り出し位置 (x, y, w, h): </label>
                <input type="number" min="0" max="${canvas.width}" step="1" value="28" style="width:60px;" id="echo-crop-x">
                <input type="number" min="0" max="${canvas.height}" step="1" value="651" style="width:60px;" id="echo-crop-y">
                <input type="number" min="1" max="${canvas.width}" step="1" value="180" style="width:60px;" id="echo-crop-w">
                <input type="number" min="1" max="${canvas.height}" step="1" value="180" style="width:60px;" id="echo-crop-h">
            `;
            this.ocrWindow.appendChild(echoCropWrapper);
            this.echoCropInputs = {
                x: echoCropWrapper.querySelector('#echo-crop-x'),
                y: echoCropWrapper.querySelector('#echo-crop-y'),
                w: echoCropWrapper.querySelector('#echo-crop-w'),
                h: echoCropWrapper.querySelector('#echo-crop-h')
            };
            // 値変更時にプレビュー更新
            ['x', 'y', 'w', 'h'].forEach(key => {
                this.echoCropInputs[key].addEventListener('input', () => this.updateEchoCropPreview(canvas));
            });
            this.echoCropInputsAppended = true;
        }

        // 初回または値変更時にプレビュー更新
        this.updateEchoCropPreview(canvas);

        // echo画像一覧を取得
        if (!this.echoImageList) {
            const echoData = gameDataManager.getEchoData();
            this.echoImageList = {
                cost1: echoData.filter(e => e.cost === 1).map(e => echoImgDir + 'cost1/' + e.id + '.webp'), 
                cost3: echoData.filter(e => e.cost === 3).map(e => echoImgDir + 'cost3/' + e.id + '.webp'),
                cost4: echoData.filter(e => e.cost === 4).map(e => echoImgDir + 'cost4/' + e.id + '.webp'),
            };
        }

        // echo画像の類似度判定
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

        
        // // ボタン押下時のみ類似画像検索を実行
        // if (!this.echoMatchButton) {
        //     this.echoMatchButton = document.createElement('button');
        //     this.echoMatchButton.textContent = 'Echo類似画像検索を実行';
        //     this.echoMatchButton.style.margin = '8px 0';
        //     this.ocrWindow.appendChild(this.echoMatchButton);
        // }
        // this.echoMatchButton.onclick = () => this.updateEchoMatch(
        //     canvas, getImageData, compareImages, echoImgDir, this.echoImageList.cost4);
        
        this.updateEchoMatch(canvas, getImageData, compareImages, echoImgDir, this.echoImageList.cost4);


        // プレビュー更新時はプレビューのみ
        this.updateEchoCropPreview = (canvasRef) => {
            const cropX = parseInt(this.echoCropInputs.x.value, 10) || 0;
            const cropY = parseInt(this.echoCropInputs.y.value, 10) || 0;
            const cropW = parseInt(this.echoCropInputs.w.value, 10) || canvasRef.width;
            const cropH = parseInt(this.echoCropInputs.h.value, 10) || canvasRef.height;

            // echo画像切り出し
            const echoCropCanvas = document.createElement('canvas');
            echoCropCanvas.width = cropW;
            echoCropCanvas.height = cropH;
            echoCropCanvas.getContext('2d').drawImage(canvasRef, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

            // プレビュー画像更新
            this.echoCropPreviewImg.src = echoCropCanvas.toDataURL();
            // 類似画像検索はしない
        };
    }
    updateEchoMatch(canvas, getImageData, compareImages, echoImgDir, echoImageList) {
        const cropX = parseInt(this.echoCropInputs.x.value, 10) || 0;
        const cropY = parseInt(this.echoCropInputs.y.value, 10) || 0;
        const cropW = parseInt(this.echoCropInputs.w.value, 10) || canvas.width;
        const cropH = parseInt(this.echoCropInputs.h.value, 10) || canvas.height;

        // echo画像切り出し
        const echoCropCanvas = document.createElement('canvas');
        echoCropCanvas.width = cropW;
        echoCropCanvas.height = cropH;
        echoCropCanvas.getContext('2d').drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

        const cropData = getImageData(echoCropCanvas, cropW, cropH);
        let bestMatch = null, bestScore = Infinity;
        let loaded = 0;
        echoImageList.forEach(filePath => {
            const imgElem = new window.Image();
            imgElem.crossOrigin = 'anonymous';
            imgElem.onload = () => {
                // サイズを合わせて比較
                const w = cropW, h = cropH;
                const data = getImageData(imgElem, w, h);
                const score = compareImages(cropData, data);
                if (score < bestScore) {
                    bestScore = score;
                    bestMatch = filePath;
                }
                loaded++;
                // 最後までいったら
                if (loaded === echoImageList.length) {
                    // bestMatchが存在したらセット
                    if (bestMatch) {
                        this.matchedEchoThumb.src = bestMatch;

                        // matchedEchoThumb.srcの値に"echo"が含まれていたらoption選択
                        const src = this.matchedEchoThumb.src;
                        if (src.includes('echo')) {
                            // 1. ファイル名を取得（拡張子を除いたもの、これがechoのid）
                            const fileName = src.split('/').pop().split('.')[0];
                            // 2. echoデータを参照しid一致を探す
                            const echoData = gameDataManager.getEchoData();
                            const matchedEcho = echoData.find(e => String(e.id) === fileName);
                            if (matchedEcho) {
                                // 3. name情報で#echo-selectのoptionを選択
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
		this.labels = [
			"クリティカルダメージ", "クリティカル", "通常攻撃ダメージアップ", "重撃ダメージアップ",
			"共鳴解放ダメージアップ", "共鳴スキルダメージアップ", "共鳴効率", "攻撃力", "防御力",
			"HP回復効果アップ", "HP"
		];
	}


	correctParamName(paramPart) {
        if (paramPart.includes("攻撃") && !paramPart.includes("ダメージアップ")) return "攻撃力";
		if (paramPart.includes("防御")) return "防御力";
		return null;
	}

    normalizeParamPart(paramPart) {
        if (
            paramPart.length > 0 &&
            !this.labels.some(label => paramPart[0] === label[0])
        ) {
            paramPart = paramPart.substring(1); // 1文字だけ削除
        }
        return paramPart;
    }
    getValuePart(text) {
        text = text.replace(
            /[^\u4E00-\u9FAF\u3040-\u309F\u30A0-\u30FFa-zA-Z0-9.%]/g, ''
        );
        const percentMatch = text.match(/(\d{1,3}\.\d+%|\d{1,3}%)/);
        const numberMatch = text.match(/(\d{2,3})/);
        return percentMatch ? percentMatch[0] : (numberMatch ? numberMatch[0] : '');
    }

    getClosestLabel(paramPart) {
        // Normalize before comparing
        const normalized = this.normalizeParamPart(paramPart);
        const similarity = (a, b) => {
            let matches = 0;
            for (let i = 0; i < Math.min(a.length, b.length); i++) {
                if (a[i] === b[i]) matches++;
            }
            return matches / Math.max(a.length, b.length);
        };

        let bestMatch = normalized,
            highestScore = 0;
        for (const label of this.labels) {
            const score = similarity(normalized, label);
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


        const result = {};
        if (lines.length) {
            const isNoName = lines[0].startsWith('NoName');

            // echoName: allow leading "・"
            if (isNoName) {
                result.echoName = "No Name";
            } else {
                result.echoName = lines[0].slice(0, -1).replace(/[\s\p{P}\p{S}@]{1,3}$/gu, '');
            }

            // COST
            const costMatch = lines[1].match(/cost(\d)/i);
            result.cost = costMatch ? costMatch[1] : '不明';

            // Main Status 1
            if (isNoName) {
                lines[2] = lines[2] + lines[3]
                lines.splice(3, 1);
            }
            const mainStatus1Line = lines[2];
            const value1 = this.getValuePart(mainStatus1Line)
            let param1Part = mainStatus1Line.replace(value1, '')
            param1Part = this.normalizeParamPart(param1Part);
            const paramName1 = this.correctParamName(param1Part) || this.getClosestLabel(param1Part);
            console.log('paramName1', paramName1, 'value1:', value1);

            // Main Status 2
            const mainStatus2Line = lines[3];
            const value2 = this.getValuePart(mainStatus2Line)
            let param2Part = mainStatus2Line.replace(value2, '')
            param2Part = this.normalizeParamPart(param2Part);
            const paramName2 = this.correctParamName(param2Part) || this.getClosestLabel(param2Part);
            console.log('paramName2:', paramName2, 'value2:', value2);

            result.mainStatus = {
                'paramName1': paramName1,
                'value1': value1,
                'paramName2': paramName2,
                'value2': value2,
            };

            if (result.cost === '不明') {
                const v2 = parseFloat(result.mainStatus.value2);
                if (v2 === 100) result.cost = '3';
                else if (v2 === 150) result.cost = '4';
                else if (v2 > 150) result.cost = '1';
            }

            // Sub Status
            result.subStatus = [];
            const subStatusLines = lines.slice(-5); // Get the last 5 lines
            subStatusLines.forEach(text => {
                const subStatusValue = this.getValuePart(text)
                let paramPart = text.replace(subStatusValue, '');
                paramPart = this.normalizeParamPart(paramPart);
                const subStatusParamName = this.correctParamName(paramPart) || this.getClosestLabel(paramPart);

                result.subStatus.push({
                    paramName: subStatusParamName,
                    value: subStatusValue
                });
            });
        }
        console.log('Parsed OCR Result:', result);
        return result;
    }
}


class ScoreCheckerUI {
    constructor() {
        this.echoSelect = document.getElementById('echo-select');
        this.mainOption1 = document.getElementById('main-option-1');
        this.mainOption1Value = document.getElementById('main-option-1-value');
        this.mainOption2 = document.getElementById('main-option-2');
        this.mainOption2Value = document.getElementById('main-option-2-value');
        this.subStatsTable = document.querySelector('#sub-stats-table tbody');
        this.echoData = [];
        this.mainStatus1Labels = [
            "クリティカル",
            "クリティカルダメージ",
            "HP",
            "攻撃力",
            "防御力",
            "共鳴効率",
            "HP回復効果アップ",
            "凝縮ダメージアップ",
            "焦熱ダメージアップ",
            "電導ダメージアップ",
            "気動ダメージアップ",
            "回折ダメージアップ",
            "消滅ダメージアップ",

        ];
        this.mainStatus2Labels = [
            "HP",
            "攻撃力",
        ];
        this.subStatusLabels = [
            "クリティカル",
            "クリティカルダメージ",
            "HP",
            "攻撃力",
            "防御力",
            "共鳴効率",
            "通常攻撃ダメージアップ",
            "重撃ダメージアップ",
            "共鳴スキルダメージアップ",
            "共鳴解放ダメージアップ",
        ];
        this.init();
    }

    init() {
        this.echoData = gameDataManager.getEchoData();
        this.initEchoSelect();
        this.initMainStatsTable();
        this.initSubStatsTable();
    }

    initMainStatsTable() {
        this.mainOption1.innerHTML = '';
        this.mainStatus1Labels.forEach(optionValue => {
            const option = document.createElement('option');
            option.value = optionValue;
            option.textContent = optionValue;
            console.log('mainOption1:', option);
            this.mainOption1.appendChild(option);
        });

        this.mainOption2.innerHTML = '';
        this.mainStatus2Labels.forEach(optionValue => {
            const option = document.createElement('option');
            option.value = optionValue;
            option.textContent = optionValue;
            this.mainOption2.appendChild(option);
        });
    }

    initSubStatsTable() {
        const selects = this.subStatsTable.querySelectorAll('select');
        selects.forEach(select => {
            select.innerHTML = '';
            this.subStatusLabels.forEach(opt => {
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
        this.setSelectByLabel(this.mainOption1, mainStatus.paramName1, this.mainStatus1Labels);
        // Set value
        this.mainOption1Value.value = mainStatus.value1;

        // Set paramName2
        this.setSelectByLabel(this.mainOption2, mainStatus.paramName2, this.mainStatus2Labels);
        // Set value2
        this.mainOption2Value.value = mainStatus.value2;
    }
    setSubStatus(subStatus) {
        // 既存のtr要素を取得
        const rows = Array.from(this.subStatsTable.querySelectorAll('tr'));
        for (let i = 0; i < subStatus.length; i++) {
            const sub = subStatus[i];
            let tr = rows[i];
            // selectとinputを取得
            const select = tr.querySelector('select');
            const input = tr.querySelector('input');
            // 値をセット
            this.setSelectByLabel(select, sub.paramName, this.subStatusLabels);
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



gameDataManager.loadData((data) => {
    // Initialize the CharacterManager
    new CharaSelecter();

    // Instantiate UI
    const scoreCheckerUI = new ScoreCheckerUI();

    // OCRWindow with callback
    new OCRWindow(function (ocrResult) {
        console.log('OCR Result:', ocrResult);
        // 1. echoName
        if (ocrResult.echoName) scoreCheckerUI.setEchoByName(ocrResult.echoName);
        // 2. mainStatus
        if (ocrResult.mainStatus) scoreCheckerUI.setMainStatus(ocrResult.mainStatus);
        // 3. subStatus
        if (ocrResult.subStatus) scoreCheckerUI.setSubStatus(ocrResult.subStatus);
        // 4. update main-option-2 and value (already handled in setEchoByName)
    });
});