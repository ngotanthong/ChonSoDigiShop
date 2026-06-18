// --- AI SCORING ENGINE ---
function analyzeSIM(numStr, monthlyFee = 0) {
            let score = 0;
            let categories = [];
            let reasons = [];
            let highlight = ''; // Đoạn được highlight

            const isPhongThuyMode = document.getElementById('togglePhongThuy') && document.getElementById('togglePhongThuy').checked;

            if (isPhongThuyMode) {
                // Tính điểm thuần Phong Thuỷ
                
                // 1. Tổng nút (tổng 10 số)
                const sum10 = numStr.split('').reduce((acc, val) => acc + parseInt(val), 0);
                const nut = sum10 % 10;
                if (nut >= 7) { 
                    score += (nut === 9) ? 40 : (nut === 8 ? 30 : 20);
                    reasons.push('Nút ' + nut);
                    categories.push('phongthuy');
                }
