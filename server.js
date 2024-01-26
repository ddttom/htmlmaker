const puppeteer = require('puppeteer');
const  logger = require( './api/logging/logger');
const url = require ('url');
const http = require('http');
const fs = require("fs");


const port = process.env.PORT || 3002;

http.createServer(async (req, res) => {
    let HTMLurl = '';
    let outName = 'mine.html';

    if (req.url.startsWith('/readHTML')) {
        let queryObject;
        queryObject = url.parse(req.url, true).query;
        let queryValue = queryObject.path + "";

        if (queryValue.startsWith('/')) {
            queryValue = queryValue.substring(1);
        }

        if (!queryObject.path) {
            res.writeHead(400, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({message: 'Missing path query parameter'}));
            return;
        }

        HTMLurl = queryObject.path.toString();
    } else if (req.url === '/') {
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end('<h1>Welcome to the HTML Creator service.</h1><a href="/readHTML?path=https://ddttom.global.ssl.fastly.net/hometest.html">Click here to check an image</a>');
    } else {
        res.writeHead(404, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({message: 'Resource not found'}));
    }
    await scrape(HTMLurl, outName);
    res.end();
}).listen(port, () => {
    console.log(`Server running on http://localhost:${port}/readHTML?path=https://ddttom.global.ssl.fastly.net/hometest.html`);
});


logger.info(`Server running on http://localhost:${port}/readHTML?path=https://ddttom.global.ssl.fastly.net/hometest.html`);



async function scrape(url,filePath) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url, {
        waitUntil: 'networkidle2' // Waits for the network to be idle (no more than 2 network connections for at least 500 ms)
    });

    // Wait for the necessary JavaScript to execute (optional, adjust as necessary)
    // await page.waitForSelector('selector'); // Example: wait for a specific element to load

    // Extract the DOM content
    const content = await page.content(); // Gets the entire HTML contents of the page as a string

    // Close the browser
    await browser.close();

    // save the DOM content
    fs.writeFile(filePath, content, (err) => {
        if (err) {
            logger.crit(`Error writing file: ${err}`);
        } else {
            logger.info(`Saved DOM content to ${filePath}`);

        }
    });
}

