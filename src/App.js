import React, {Component} from 'react';
import './lib/fa/css/fontawesome-all.min.css';
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider';
import getMuiTheme from 'material-ui/styles/getMuiTheme';
import RaisedButton from 'material-ui/RaisedButton';
import FlatButton from 'material-ui/FlatButton';
import AppBar from 'material-ui/AppBar';
import FontIcon from 'material-ui/FontIcon';
import SvgIcon from 'material-ui/SvgIcon';
import IconButton from 'material-ui/IconButton';
import Dialog from 'material-ui/Dialog';
import marked from 'marked';
import TurndownService from 'turndown';
import MarkdownMark from './markdown-mark.js';
import {tables} from 'turndown-plugin-gfm';
import {createPatch} from 'diff';
import {Diff2Html} from 'diff2html';
import diff2HtmlStyles from './diff2htmlStyles.js';
import JSZip from 'jszip';
import {saveAs} from 'file-saver';

//app theme setup

const muiTheme = getMuiTheme({
  fontFamily: 'Roboto, sans-serif, Microsoft YaHei, 微软雅黑, 微軟雅黑',
});

//marked setup

const renderer = new marked.Renderer();

renderer.heading = (text, level) => {
    return `<h${level}>${text}</h${level}>\n`;
};

renderer.tablecell = function(content, flags) {
  var type = flags.header ? 'th' : 'td';
  var tag = flags.align
    ? '<' + type + ' align="' + flags.align + '">'
    : '<' + type + '>';
  return tag + content + '</' + type + '>\n';
};

renderer.code = (code) => {

  const escapedCode = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  const commentStart = '</code><span class="code-comment">';
  const commentEnd = '</span><code>';

  const commentOmittedCode = escapedCode
    .replace(/^(.*(?:(?:\/\/)|#) ?)(.+)$|(\/\* ?)([^]+?)( ?\*\/)|(&lt;!-- ?)([^]+?)( ?--&gt;)/gm, (match, p1, p2, p3, p4, p5, p6, p7, p8) => {
      if (p1) {
        return `${p1}${commentStart}${p2}${commentEnd}`;
      } else if (p3) {
        return `${p3}${commentStart}${p4}${commentEnd}${p5}`;
      } else if (p6) {
        return `${p6}${commentStart}${p7}${commentEnd}${p8}`;
      }
    });

  return `<pre><code>${commentOmittedCode}</code></pre>\n`;
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
  emDelimiter: '*',
  hr: '---',
  blankReplacement: (content, node) => {
    if (node.attributes.length) {
      return node.outerHTML;
    } else {
      return node.isBlock ? '\n\n' : '';
    }
  },
});

turndownService.use(tables);

turndownService.useCRLF = false;

//keep rule needs to be added with `addRule` to take precedence over standard rules
turndownService.addRule('noReplace', {
  filter: (node) => {
    const keepers = ['span', 'p', 'div'];
    return keepers.indexOf(node.nodeName.toLowerCase()) > -1
      && node.attributes.length;
  },
  replacement: (content, node) => {
    return `${node.outerHTML.match(/<.+?>/)[0]}${content}</${node.nodeName.toLowerCase()}>`;
  },
});

turndownService.addRule('removeScript', {
  filter: 'script',
  replacement: (content) => ''
});

turndownService.addRule('strike', {
  filter: ['del', 's', 'strike'],
  replacement: (content) => {
    return `~~${content}~~`;
  },
});

turndownService.addRule('listItem', {
  filter: 'li',

  replacement: function (content, node, options) {
    const cleanContent = content
      .replace(/^\n+/, '') // remove leading newlines
      .replace(/\n+$/, '\n') // replace trailing newlines with just a single one
      .replace(/\n/gm, '\n  '); // indent
    let prefix = options.bulletListMarker + ' ';
    const parent = node.parentNode;
    if (parent.nodeName === 'OL') {
      const start = parent.getAttribute('start');
      const index = Array.prototype.indexOf.call(parent.children, node);
      prefix = (start ? Number(start) + index : index + 1) + '. ';
    }
    return (
      prefix + cleanContent + (node.nextSibling && !/\n$/.test(cleanContent) ? '\n' : '')
    );
  }
});

turndownService.addRule('fencedCodeBlock', {
  filter: (node) => {
    return node.nodeName === 'PRE'
    && node.firstChild
    && node.firstChild.nodeName === 'CODE';
  },
  replacement: (content, node, options) => {
    return `

${options.fence}
${node.textContent}
${options.fence}

`;
  }
});

// ---

const formatDate = (date) => {
  return date.valueOf().toString(36);
}

const markUp = (markdown, title) => {

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>${title && title.replace(/.+/, '')}</title>
    <style type="text/css">
      body {font-family:'Calibri',sans-serif;width:calc(100% - 250px)}h1,h2,h3,h4,h5,h6 {font-family:'Cambria',serif}table {border-collapse:collapse}thead{font-weight:bold}td{border:1px solid gray}.code-comment{background:gainsboro}.hidden{display:none;}.conditionalized{background:#ff8}
    </style>
  </head>
  <body>
    ${marked(markdown)}
    <script>"use strict";{var n=function(c,a,b){return b.indexOf(c)===a},o=function(a){return document.querySelector(a)},i=function(a){return document.querySelectorAll(a)},t=Array.from(i("[condition]")).map(function(a){return a.getAttribute("condition")}).filter(n),d=[];t.forEach(function(a){return d.push({o:a,values:Array.from(i("["+a+"]")).map(function(b){return b.getAttribute(a)}).filter(n)})});var e=d.filter(function(a){return 1<a.values.length});if(e.length){e.forEach(function(a){a.values.forEach(function(b,c){i("["+a.o+"]").forEach(function(f){f.classList.add("conditionalized")}),0!==c&&i("["+a.o+"="+b+"]").forEach(function(f){f.classList.add("hidden")})})});var _n2=e.map(function(a){return"<div><strong>"+a.o+"</strong>: "+a.values.map(function(b,c){return"<label style='padding:10px;cursor:pointer'><input type='radio' class='conditionToggle' style='cursor:pointer' name='"+a.o+"' value='"+b+"'"+(0===c?" checked":"")+"> "+b+"</label>"}).join(" ")+"</div>"}).join("");o("body").insertAdjacentHTML("afterbegin","<div style='position:fixed;top:0;right:0;bottom:0;width:200px;padding:0 0 0 20px'><h5>Show <span class='conditionalized'>conditional content</span></h5>"+_n2+"</div>"),i(".conditionToggle").forEach(function(a){a.addEventListener("change",function(b){b.target.checked&&(i("["+b.target.name+"="+b.target.value+"]").forEach(function(c){c.classList.remove("hidden")}),i("["+b.target.name+"]:not(["+b.target.name+"="+b.target.value+"])").forEach(function(c){c.classList.add("hidden")}))})})}}</script>

  </body>
</html>
`;
}

const turnDown = (html) => {

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const allContent = doc.querySelector('body');

  let turnedDown = turndownService.turndown(allContent)
    .replace(/(\n\s+$)+/gm, '\n')
    .replace(/\n?$/, '\n')

  if (turndownService.useCRLF) {
    turnedDown = turnedDown.replace(/\n/g, '\r\n');
  }

  return turnedDown;

}

const checkFidelity = (markdown, filename) => {

  const parser = new DOMParser();

  const markedOnce = markUp(markdown);
  const turnedOnce = turnDown(markedOnce);
  const markedTwice = markUp(turnedOnce);

  const doc1 = parser.parseFromString(markedOnce, 'text/html');
  const doc2 = parser.parseFromString(markedTwice, 'text/html');

  const content1 = doc1.querySelector('body');
  const content2 = doc2.querySelector('body');

  const htmlDiff = createPatch(filename, content1.innerHTML.trim(), content2.innerHTML.trim());
  const mdDiff = createPatch(filename, markdown.replace(/\r?\n/g, '\n').trim(), turnedOnce.replace(/\r?\n/g, '\n').trim()); //ignore diff between CRLF and LF

  const title = `Diff Report for File: ${filename}`;

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>${title}</title>
    <style type="text/css">
      body {font-family: "Calibri", sans-serif}
      ${diff2HtmlStyles}
      .d2h-code-line-ctn {white-space: pre-wrap}
    </style>
  </head>
  <body>
    <h1>${title}</h1>
    <div><em>Generated ${new Date().toString()}</em></div>
    <h2>HTML diff</h2>
    ${Diff2Html.getPrettyHtml(htmlDiff, {inputFormat: 'diff', matching: 'lines'})}
    <h2>Markdown diff</h2>
    ${Diff2Html.getPrettyHtml(mdDiff, {inputFormat: 'diff', matching: 'lines'})}
  </body>
</html>
`;
}

const htmlToggle = (<span>HTML<br /><FontIcon className='fa fa-code' style={{fontSize: '1em'}} /></span>);
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
      this.handleDialogOpen();
    }
  };

  handleDialogClose = () => {
    this.setState({dialogOpen: false});
  };

  handleDialogOpen = () => {
    this.setState({dialogOpen: true});
  };

  state = {
    isFromHtml: false,
    inputSource: null,
    fileName: null,
    fromExt: null,
    toExt: null,
    dialogOpen: false
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
          <Dialog
            title='No file uploaded'
            actions={[<FlatButton
              label='OK'
              primary={true}
              onClick={this.handleDialogClose}
              keyboardFocused={true}
            />]}
            modal={false}
            open={this.state.dialogOpen}
            onRequestClose={this.handleDialogClose}
          >
            Please upload a file.
          </Dialog>
        </div>
      </MuiThemeProvider>
    );
  }
}

export default App;
