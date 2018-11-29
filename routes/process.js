var express = require('express');
var router = express.Router();
const DOMParser = require('dom-parser');
const https = require('https');
const _ = require('lodash');
const fs = require('fs');
const fileName = `render/out.html`;
let inProgress = 0;
let panicStop = false;
let pl = { status: 'ready', log: '' };

// Uppercase Text
const UC = function (v) {
  return v.toUpperCase();
};

const onCrawled = (links) => {
  let html = '';
  html += `<ul>\n`;
  links.map((link) => {
    if (link.title === '') {
      link.title = link.url.replace('https://www.geekwrapped.com/', '').replace(/[\/-]/g, ' ').replace(/\b([a-z])/g, UC);
      if (link.title === '') {
        link.title = 'Home page';
      }
    }
    html += `  <li><a class="bodylink" href="${link.url}">${link.title}</a></li>\n`;
  });
  html += `</ul>\n`;
  fs.writeFile(fileName, html, function (err) {
    if (err) throw err;
  });
};

const crawlLink = (link) => {
  https.get(link.url, (linkResp) => {
    let linkData = '';
    // A chunk of data has been recieved.
    linkResp.on('data', (chunk) => {
      linkData += chunk;
    });
    
    linkResp.on('end', () => {
      if (panicStop) {
        inProgress = 0;
        reject('panicStop')
      }
      const mch = linkData.match(/<title>([^<]*?)<\/title>/i);
      if (mch) {
        link.title = mch[1];
      } else {
        console.error('Link Title Not Found:', link.url);
      }
      inProgress -= 1;
    });
  }).on('error', (e) => {
    // inProgress -= 1;
    console.error(e);
    link = crawlLink(link);
  });
  return link;
};

const processLog = function (obj) {
  const fileName = 'render/processLog.log';
  let strObj;
  if (_.isObject(obj)) {
    strObj = JSON.stringify(obj);
    fs.writeFileSync(fileName, strObj);
  }
  try {
    strObj = fs.readFileSync(fileName);
    obj = JSON.parse(strObj);
  } catch (e) {
  }
  return obj;
};

const start = async () => {
  pl = processLog();
  pl.log = 'Download geekwrapped Sitemap';
  processLog(pl);
  return new Promise((resolve, reject) => {
    
    https.get('https://www.geekwrapped.com/sitemap.xml', (resp) => {
      let data = '';
      // A chunk of data has been recieved.
      resp.on('data', (chunk) => {
        data += chunk;
      });
      // The whole response has been received. Print out the result.
      resp.on('end', () => {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(data, "text/xml");
        const nodes = xmlDoc.getElementsByTagName('loc');
        const links = [];
        if (nodes.length > 0) {
          pl = processLog();
          pl.log = `${nodes.length} Links Found`;
          processLog(pl);
          nodes.map((node) => {
            links.push({
              url: node.innerHTML,
              title: '',
            });
            return node;
          });
          
          if (links.length > 0) {
            pl = processLog();
            pl.log = 'Start Crawling';
            processLog(pl);
            
            const linksPages = _.chunk(links, 10);
            const totalPages = linksPages.length;
            let currentPage = 0;
            const timer = setInterval(() => {
              if (panicStop) {
                clearInterval(timer);
                inProgress = 0;
                reject('panicStop')
              }
              currentPage += 1;
              if (totalPages == currentPage) {
                clearInterval(timer);
                let prevAwaitCount = inProgress;
                let prevAwaitTimes = 0;
                const awaitTimer = setInterval(() => {
                  if (panicStop) {
                    clearInterval(awaitTimer);
                    inProgress = 0;
                    reject('panicStop')
                  }
                  if (inProgress <= 0) {
                    pl.log = `All Requests Done`;
                    processLog(pl);
                    onCrawled(_.concat(links));
                    clearInterval(awaitTimer);
                    resolve();
                  } else {
                    pl.log = `Await For ${inProgress} Requests`;
                    processLog(pl);
                    if (prevAwaitCount !== inProgress) {
                      prevAwaitCount = inProgress;
                      prevAwaitTimes = 0;
                    } else {
                      prevAwaitTimes += 1;
                      if (prevAwaitTimes >= 60) {
                        inProgress = 0;
                      }
                    }
                  }
                }, 1000);
              } else {
                linksPages[currentPage].map((link) => {
                  inProgress += 1;
                  link = crawlLink(link);
                  return link;
                });
                pl = processLog();
                pl.log = `${currentPage * 10} of ${totalPages * 10} links crawled`;
                processLog(pl);
              }
            }, 500);
          }
        } else {
          pl = processLog();
          pl.log = 'Sitemap Links Not Found';
          processLog(pl);
          reject('Sitemap Links Not Found');
        }
      });
    }).on('error', (err) => {
      reject(`Error: ${err.message}`);
      console.error(`Error: ${err.message}`);
    });
  });
};

const getHtmlSitemap = () => {
  let html = '';
  if (fs.existsSync(fileName)) {
    html = fs.readFileSync(fileName);
  }
  return html;
};

/* GET process listing. */
router.get('/', function (req, res, next) {
  pl = processLog();
  
  if (!_.isNil(pl)) {
    if (_.isNil(pl.status) || pl.status === 'ready') {
      try {
        start().then(() => {
          pl.status = 'finished';
          pl.log = pl.log || '';
          pl = processLog(pl);
        });
        pl.status = 'in_progress';
        pl.log = pl.log || '';
        pl = processLog(pl);
      } catch (e) {
        //this will eventually be handled by your error handling middleware
        next(e)
      }
      // res.send('Process started');
      res.render('process', { process: pl, link_url: '/process/stop/', link_title: 'Stop crawling', sitemap: '' });
    } else if (pl.status === 'in_progress')  {
      // res.send('In progress');
      res.render('process', { process: pl, link_url: '/process/stop/', link_title: 'Stop crawling', sitemap: '' });
    } else if (pl.status === 'finished')  {
      // res.send('Process finished');
      res.render('process', { process: pl, link_url: '/process/restart/', link_title: 'Restart', sitemap: getHtmlSitemap() });
    }
  } else {
    // No found...
    pl = processLog({ status: 'ready', log: '' });
    res.redirect('/process/');
  }
  
  console.log('pl', pl);
  
});

router.get('/restart/', function (req, res, next) {
  
  pl = processLog();
  if (!_.isNil(pl) && !_.isNil(pl.status)) {
    pl.status = 'ready';
    pl.log = '';
    processLog(pl);
  }
  res.redirect('/process/');
});

router.get('/stop/', function (req, res, next) {
  
  pl = processLog();
  if (!_.isNil(pl) && !_.isNil(pl.status)) {
    pl.status = 'finished';
    processLog(pl);
  }
  res.redirect('/process/');
  
});

// router.get('/status/', function (req, res, next) {
//
//   pl = processLog();
//   res.render('process_status', { process: pl, link_url: '/process/restart/', link_title: 'Restart' });
//
// });

module.exports = router;
