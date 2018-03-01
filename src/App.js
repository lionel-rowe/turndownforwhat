import React, { Component } from 'react';
import './lib/fa/css/fontawesome-all.min.css';
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider';
import getMuiTheme from 'material-ui/styles/getMuiTheme';
import RaisedButton from 'material-ui/RaisedButton';
import FlatButton from 'material-ui/FlatButton';
import AppBar from 'material-ui/AppBar';
import FontIcon from 'material-ui/FontIcon';
import SvgIcon from 'material-ui/SvgIcon';
import IconButton from 'material-ui/IconButton';
import marked from 'marked';
import TurndownService from './turndown/lib/turndown.es.js';
import MarkdownMark from './markdown-mark.js';
import {gfm} from 'turndown-plugin-gfm';
import {diffWords} from 'diff';
import JSZip from 'jszip';
import {saveAs} from 'file-saver';

//app theme setup

const muiTheme = getMuiTheme({
  fontFamily: 'Roboto, Microsoft YaHei, 微软雅黑, 微軟雅黑, sans-serif',
});


//marked setup

const renderer = new marked.Renderer();
renderer.heading = function(text, level) {
    return `<h${level}>${text}</h${level}>`;
};

marked.setOptions({
  gfm: true,
  tables: true,
  sanitize: false,
  smartLists: true,
  smartypants: false,
  xhtml: false,
  renderer: renderer
});

//turndown setup

const turndownService = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  hr: '_'.repeat(30),
  blankReplacement: (content, node) => {
    if (node.attributes.length) {
      return node.outerHTML;
    } else {
      return node.isBlock ? '\n\n' : '';
    }
  },
});

turndownService.use(gfm);

turndownService.addRule('noReplace', {
  filter: (node) => {
    const keepers = ['span', 'p', 'div'];
    return keepers.indexOf(node.nodeName.toLowerCase()) > -1
      && node.attributes.length;
  },
  replacement: (content, node) => {
    return `${node.outerHTML.match(/<.+?>/)[0]}${content}</${node.nodeName.toLowerCase()}>`;
  }
});

// ---

const formatDate = (date) => {
  // return `${date.getFullYear()}${`${date.getMonth() + 1}`.padStart(2, '0')}${`${date.getDate()}`.padStart(2, '0')}_${date.getHours()}${date.getMinutes()}${date.getSeconds()}`;
  return date.valueOf().toString(36);
}

const markUp = (markdown, title) => {

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>${title && title.replace(/.+/, '')}</title>
    <style type="text/css">
      [site]:not([site="intl"]) {
        display: none;
      }
    </style>
  </head>
  <body>
    ${marked(markdown)}
  </body>
</html>
`;
}

const turnDown = (html) => {

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const allContent = doc.querySelector('body');

  const turnedDown = turndownService.turndown(allContent);
  const turnedDownNormalized = turnedDown.replace(/(\n\s+$)+/gm, '\n');

  return turnedDownNormalized + '\n';
}

const checkFidelity = (markdown, title) => {

  const parser = new DOMParser();

  const markedOnce = markUp(markdown);
  const turnedOnce = turnDown(markedOnce);
  const markedTwice = markUp(turnedOnce);

  const doc1 = parser.parseFromString(markedOnce, 'text/html');
  const doc2 = parser.parseFromString(markedTwice, 'text/html');

  const content1 = doc1.querySelector('body');
  const content2 = doc2.querySelector('body');

  const htmlDiff = diffWords(content1.innerHTML, content2.innerHTML);
  const mdDiff = diffWords(markdown, turnedOnce);

  const formatDiff = (diff) => {
    const diffMap = diff.map(part => {
      const background = part.added
      ? 'lawngreen'
      : part.removed
        ? 'salmon'
        : null;
      const partSpan = document.createElement('span');
      partSpan.style.background = background;
      partSpan.textContent = part.value;
      return partSpan;
    });
    const containerDiv = document.createElement('div');
    diffMap.forEach(span => containerDiv.appendChild(span));
    return `<pre><code>${containerDiv.innerHTML}</pre></code>`;
  }

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>${title} &mdash; diff report</title>
    <style type="text/css">
      body {
        font-family: 'Calibri', sans-serif;
        max-width: 750px;
        margin: auto;
      }
      pre {
        white-space: pre-wrap;
      }
    </style>
  </head>
  <body>
    <h1>${title} &mdash; diff report</h1>
    <h2>Markdown diff</h2>
    ${formatDiff(mdDiff)}
    <h2>HTML diff</h2>
    ${formatDiff(htmlDiff)}
  </body>
</html>
`;
}

const htmlToggle = (<span>HTML<br /><FontIcon className='fab fa-html5' title='HTML' /></span>);
const markdownToggle = (<span>Markdown<br /><SvgIcon width='208' height='128' viewBox='0 0 208 128'><MarkdownMark /></SvgIcon></span>);

class App extends Component {

  readFile = (event) => {
    const e = event.nativeEvent;
    const file = e.target.files[0];
    e.preventDefault();

    const fileReader = new FileReader();
    if (file) {
      fileReader.readAsText(file, 'UTF-8');
      fileReader.addEventListener('load', fle => {
        const fileSplit = e.target.value ? e.target.value.split(/[\\/]/) : null;
        const fileNameComponents = fileSplit ? fileSplit[fileSplit.length - 1].match(/(.+)\.(\w+)$/) : null;
        const fileName = fileNameComponents[1] ? fileNameComponents[1] : null;
        const fromExt = fileNameComponents[2] ? fileNameComponents[2] : null;
        const isFromHtml = /^html?$/.test(fromExt);
        const toExt = isFromHtml ? 'md' : 'html';

        this.setState({isFromHtml: isFromHtml, inputSource: fle.target.result, fileName: fileName, fromExt: fromExt, toExt: toExt});
      });
    } else {
      this.setState({inputSource: null, fileName: null, fromExt: null, toExt: null});
    }

    // setTimeout(() => console.log(this.state), 500);

  };

  convertFile = () => {
    if (this.state.inputSource) {
      let fileContent;
      let diffReport;
      let readme;

      const bareFileName = this.state.fileName.replace(/_v_.+$/, '');
      const formattedDate = formatDate(new Date());

      if (this.state.isFromHtml) {

        fileContent = turnDown(this.state.inputSource);
        readme = 
`# README

This file was converted from HTML to Markdown.

The original HTML file was ${this.state.fileName}.${this.state.fromExt}.
`;
      } else {
        fileContent = markUp(this.state.inputSource, bareFileName);
        diffReport = checkFidelity(this.state.inputSource, bareFileName);
        readme =
`# README

This file was converted from Markdown to HTML.

The original Markdown file was ${this.state.fileName}.${this.state.fromExt}.

See DIFF_REPORT_${formattedDate}.html for any changes to expect when converting back to Markdown.
`;
      }

      const zip = new JSZip();

      const folder = zip.folder(`${bareFileName}_${formattedDate}`);

      const info = folder.folder('info');

      folder.file(`${bareFileName}_v_${formattedDate}.${this.state.toExt}`, fileContent);
      info.file(`README_${formattedDate}.md`, readme);
      if (diffReport) {
        info.file(`DIFF_REPORT_${formattedDate}.html`, diffReport);
      }

      zip.generateAsync({type: 'blob'})
      .then(content => {
        saveAs(content, `${bareFileName}_${formattedDate}.zip`);
      });

    } else {
      alert('No file uploaded. Please upload a file.')
    }
  }

  state = {
    isFromHtml: false,
    inputSource: null,
    fileName: null,
    fromExt: null,
    toExt: null
  };

  render() {

    const styles = {
      uploadInput: {
        cursor: 'pointer',
        position: 'absolute',
        top: 0,
        bottom: 0,
        right: 0,
        left: 0,
        width: '100%',
        opacity: 0,
      },
      uploadText: {
        position: 'absolute',
        left: 0,
        fontStyle: 'italic',
        color: '#888',
        textAlign: 'left',
        marginTop: 20,
        whiteSpace: 'nowrap',
      },
      form: {
        margin: '20px',
      },
      toggle: {
        display: 'inline-block',
        width: 150,
        textAlign: 'center',
        verticalAlign: 'middle'
      },
    };

    return (
      <MuiThemeProvider muiTheme={muiTheme}>
        <div className='App'>
          <AppBar
            title='TURNDOWN FOR WHAT'
            iconElementLeft={<IconButton iconClassName='fa fa-arrow-down' disabled={true} />}
          />
          <form style={styles.form}>
            <RaisedButton
              label='Upload file'
              labelPosition='before'
              containerElement='label'
            >
              <input
                type='file'
                style={styles.uploadInput}
                onChange={this.readFile}
              />
              {this.state.fileName
                ? <p style={styles.uploadText}>{this.state.fileName}.{this.state.fromExt}</p>
                : ''
              }
              
            </RaisedButton>
            {' '}
            <span style={styles.toggle}>
              {this.state.isFromHtml ? htmlToggle : markdownToggle}
            </span>
            {' '}
            <FlatButton
              icon={<FontIcon className='fa fa-exchange-alt' />}
              secondary={true}
              onClick={() => this.setState({isFromHtml: !this.state.isFromHtml})}
            />
            {' '}
            <span style={styles.toggle}>
              {this.state.isFromHtml ? markdownToggle : htmlToggle}
            </span>
            {' '}
            <RaisedButton
              label='Convert'
              labelPosition='before'
              containerElement='label'
              secondary={true}
              onClick={this.convertFile}
            />
          </form>
        </div>
      </MuiThemeProvider>
    );
  }
}

export default App;