const fs = require('fs');
let c = fs.readFileSync('index.html', 'utf8');
const replacement = `<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script src="https://unpkg.com/tesseract.js@v2.1.0/dist/tesseract.min.js"></script>
<script src="./assets/js/pdfProcessor.js"></script>
</body>`;
c = c.replace('</body>', replacement);
fs.writeFileSync('index.html', c);
