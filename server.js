const puppeteer = require('puppeteer');
const logger = require('./api/logging/logger');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const {query} = require("winston");
// Set up the server port
const port = process.env.PORT || 3002;

let sitemapURL = "https://main--edgeservices--ddttom.hlx.page/query-index.json";
let baseURL='';
// Create the HTTP server
http.createServer(async (req, res) => {

    baseURL = `https://${req.headers.host}/`;
    const myURL = new URL(req.url, baseURL);
    let queryValue = myURL.searchParams.get('path');

    if (req.url.startsWith('/sitemap')) {
        const newURL = new URL(queryValue);
        const host = newURL.host;
        await processSitemap(host);
    }

    if (req.url.startsWith('/readHTML')) {
        try {
            const result = await scrape(queryValue);
        } catch (error) {
            logger.error(`Scraping error: ${error}`);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Internal Server Error' }));
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end("done");
    }
    if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Welcome to the HTML Creator service.</h1><a href="/sitemap?path="' + sitemapURL + '">Click here to start</a>');
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Resource not found' }));
    }
}).listen(port, () => {
    logger.info(`Server running on http://localhost:${port}/`+'sitemap?path=' + sitemapURL);
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
async function processSitemap(host) {
    try {
        const sitemap = await fetchJson(sitemapURL);

        if (sitemap.data && Array.isArray(sitemap.data)) {
            for (const item of sitemap.data) {
                try {
                    await scrape("https://"+ host + item.path);
                    console.log(`Extraction successful for ${item.path}`);
                } catch (error) {
                    console.error(`Error extracting ${item.path}: ${error}`);
                }
            }
        } else {
            console.error('Invalid sitemap structure: missing or invalid "data" property');
        }
    } catch (error) {
        console.error(`Failed to fetch or process sitemap: ${error}`);
    }
}
function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(data);
                    resolve(parsedData);
                } catch (e) {
                    reject(`Error parsing JSON: ${e}`);
                }
            });
        }).on('error', (e) => {
            reject(`HTTP request failed: ${e}`);
        });
    });
}

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
