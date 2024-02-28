const puppeteer = require('puppeteer');
const logger = require('./api/logging/logger');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const {query} = require("winston");
// Set up the server port
const port = process.env.PORT || 3002;

let defaultpath = "https://ddttom.global.ssl.fastly.net/article/13-must-have-features-in-a-content-management-system";

defaultpath =  "https://ddttom.global.ssl.fastly.net/article/new-adobe-cms-a-faster-way-to-publish-content-but-at-what-cost";
// Create the HTTP server
http.createServer(async (req, res) => {
    if (req.url.startsWith('/readHTML')) {
        const baseURL = `http://${req.headers.host}/`; // Use http as we're not implementing https here
        const myURL = new URL(req.url, baseURL);
        let queryValue = myURL.searchParams.get('path');

        if (!queryValue) {
            queryValue = defaultpath;
        }

        try {
            const result = await scrape(queryValue);
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end("done");
        } catch (error) {
            logger.error(`Scraping error: ${error}`);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Internal Server Error' }));
        }
    } else if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Welcome to the HTML Creator service.</h1><a href="/readHTML?path="' + defaultpath + '">Click here to start</a>');
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Resource not found' }));
    }
}).listen(port, () => {
    logger.info(`Server running on http://localhost:${port}/`+'readHTML?path=' + defaultpath);
});

function fixup(content) {

    let contentArray = content.split('\n');
    for (let i = 0; i < contentArray.length; i++) {
        contentArray[i] = contentArray[i].trimRight();
    }
    content = contentArray.join('\n');
    while (content.includes('\n\n')) {
        content = content.replaceAll('\n\n', '\n');
    }
    content = content.replace('<script type="application/ld+json"' ,'\n<script type="application/ld+json"' );
    return content;
}

// Puppeteer function to scrape HTML content
async function scrape(url) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });

    const content = await page.content();
    await browser.close();

    const filePath = `${getLastPartOfPathWithoutExtension(url)}.html`; // Ensure extension is added
    return new Promise((resolve, reject) => {
        const fixedcontent = fixup(content);
        fs.writeFile(filePath, fixedcontent, err => {
            if (err) {
                logger.error(`Error writing file: ${err}`);
                reject(err);
            } else {
                logger.info(`Saved DOM content to ${filePath}`);
                resolve(content); // Resolve with content instead of file path
            }
        });
    });
}

// Function to extract the last part of the path without the extension
function getLastPartOfPathWithoutExtension(urlString) {
    const parsedUrl = new URL(urlString), pathname = parsedUrl.pathname;
    return path.basename(pathname, path.extname(pathname));
}
