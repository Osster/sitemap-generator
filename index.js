console.log('Download geekwrapped.com Sitemap');
const DOMParser = require('dom-parser');
const https = require('https');
const _ = require('lodash');
const fs = require('fs');
let inProgress = 0;

// Uppercase Text
const UC = function (v) {
  return v.toUpperCase();
};

const onCrawled = (links) => {
  const fileName = `out-${_.now()}.html`;
  let html = '';
  html += `<ul>\n`;
  links.map((link) => {
    if (link.title === '')
    {
      link.title = link.url.replace('https://www.geekwrapped.com/', '').replace(/[\/-]/g, ' ').replace(/\b([a-z])/g, UC);
      if (link.title === '') {
        link.title = 'Home page';
      }
    }
    html += `  <li><a class="bodylink" href="${link.url}">${link.title}</a></li>\n`;
  });
  html += `</ul>\n`;
  fs.writeFile(fileName, html, function(err){
    if(err)throw err;
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
      console.log(nodes.length, 'Links Found');
      nodes.map((node) => {
        links.push({
          url: node.innerHTML,
          title: '',
        });
        return node;
      });
      
      if (links.length > 0) {
        console.log('Start Crawling');
  
        const linksPages = _.chunk(links, 10);
        const totalPages = linksPages.length;
        let currentPage = 0;
        const timer = setInterval(() => {
          currentPage += 1;
          if (totalPages == currentPage) {
            clearInterval(timer);
            let prevAwaitCount = inProgress;
            let prevAwaitTimes = 0;
            const awaitTimer = setInterval(() => {
              if (inProgress <= 0) {
                console.error('All Requests Done');
                onCrawled(_.concat(links));
                clearInterval(awaitTimer);
              } else {
                console.error('Await For', inProgress, 'Requests');
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
            console.log(currentPage * 10, 'of', totalPages * 10, 'links crawled');
          }
        }, 500);
      }
    } else {
      console.error('Sitemap Links Not Found');
    }
  });
}).on('error', (err) => {
  console.error(`Error: ${err.message}`);
});