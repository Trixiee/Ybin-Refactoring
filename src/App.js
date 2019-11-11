import React from 'react'
import ReactDOM from 'react-dom'
import axios from 'axios'
import { Base64 } from 'js-base64'
import './App.scss'
import './font-awesome.min.css'

const deflate = require('deflate-js')
const sjcl = require('sjcl')
const Mousetrap = require('mousetrap');
require('mousetrap-global-bind') 

export default class App extends React.Component {
	constructor () {
		super()
		sjcl.random.startCollectors()
	}
	componentDidMount() {
		
		Mousetrap.bindGlobal('mod+p', event => {
			event.preventDefault()
			this.new()
		})

		Mousetrap.bindGlobal('mod+s', event => {
			event.preventDefault()
			this.save();
		})
		
		Mousetrap.bindGlobal('mod+shift+r', event => {
			event.preventDefault()
			this.raw()
		})

		Mousetrap.bindGlobal('mod+e', event => {
			event.preventDefault()
			this.fork()
		})

		Mousetrap.bindGlobal('mod+shift+c', event => {
			event.preventDefault()
			this.copy()		
		})
  	}
	state = {
		showStatus:false,
		hovered:{
			info:false,
			about:false
		},
		disabled:{
			new:false,
			save:false,
			fork:true,
			raw:true,
			copy:true,
			paste:false
		}
	}
	onNavigationIconHoverMessages = {
		newMessage : {
			message:"New paste",
			keyboardShortcut:"ctrl+p"
		},
		saveMessage:{
			message:"Save paste",
			keyboardShortcut:"ctrl+s"
		},
		forkMessage:{
			message:"Fork current paste",
			keyboardShortcut:"ctrl+e"
		},
		viewRawDate:{
			message:"View raw data",
			keyboardShortcut:"ctrl+shift+r"
		},	
		copyMessage:{
			message:"Copy link to clipboard",
			keyboardShortcut:"ctrl+shift+c"
		}
	}	
	new = () => {
		this.refs.textarea.value="";
		this.setState({
			disabled:{
				save:false,
				raw:true,
				copy:true,
				fork:true,
				paste:false
			}			
		})
	}
	showStatus = (message,timeout) => {
		this.setState({
			showStatus: true
		});
		ReactDOM.render(<>{message}</>, this.refs.status);
		if(timeout) {
			setTimeout(() => {
				this.setState({
					showStatus: false
				});	
			}, timeout)
		}
	}

	compress = message => Base64.toBase64(deflate.deflate(Base64.utob(message)))
	decompress = data => Base64.btou(deflate.inflate(Base64.fromBase64(data)))
	zeroCipher = (key, message) =>  sjcl.encrypt(key, this.compress(message))
	zeroDecipher = (key, data) => this.decompress(sjcl.decrypt(key, data))
	decryptPaste = (key, cipher) => {
		let cleartext
		try { 
			cleartext = this.zeroDecipher(key, cipher[0].data)
		} catch(err) {
			this.showStatus(<span>Wrong key.</span>,2000)
			return
		}
		this.refs.textarea.value = cleartext;
	}
	save = async () => {

		if(this.state.disabled.save){
			return;
		}
		
		if(this.refs.textarea.value.length === 0){
			this.showStatus(<>Paste can't be <span className="accent">empty</span>.</>,2000)
			return
		}

		if (!sjcl.random.isReady()) {
			this.showStatus(<>We need more <span className="accent">entropy</span>.Please move your mouse a lil\' bit more.</>, 2000)

			sjcl.random.addEventListener('seeded', ()=>{
				this.save()
			})
			return
		}
	
		this.showStatus(<span>Saving paste...</span>,2000)
	
		let randomkey = sjcl.codec.base64.fromBits(sjcl.random.randomWords(8, 0), 0)
		let cipherdata = this.zeroCipher(randomkey, this.refs.textarea.value)
		let result
		try{	
		 	result =  await axios.post('/api/v1/save', {
				data: cipherdata
			})
			if (result.status === 0) {
				window.location.href = 'https://ybin.me/p/' + result.id + '#' + randomkey
			} else if (result.status === 1) {
				this.showStatus(<>Error saving paste: <span className="accent">{result.message}</span>.</>,2000)
			} else {
				this.showStatus(<span>Error saving paste</span>,2000)
			}
			this.setState({
				disabled:{
					save:true,
					raw:false,
					copy:false,
					fork:false,
					paste:true
				}			
			})
		}catch(error){
			this.showStatus(<span>Server not responding. Try again.</span>, 2000)
		}
			
	}

	fork = () => {
		if(this.state.disabled.fork){
			return;
		}
		this.setState({
			disabled:{
				save:false,
				raw:true,
				copy:true,
				fork:true,
				paste:false
			}			
		})
	}

	raw = () => {
		if(this.state.disabled.raw){
			return;
		}
		let paste = this.refs.textarea.value
		let newDoc = document.open('text/html', 'replace')
		newDoc.write('<pre>' + paste + '</pre>')
		newDoc.close()
	}
	copy = () => {
		if(this.state.disabled.copy){
			return;
		}
		window.prompt('Copy to clipboard: Ctrl+C, Enter', window.location.href)
	}
	showInfo = (message, shortcut) => {
		ReactDOM.render(	
			<>{message}<p><span className="accent">{shortcut}</span></p></>, this.refs.info);
		this.setState({
			hovered:{
				info:true
			},
		})
	
	}
	hideInfo = () => {
		this.setState({
			hovered:{
				info:false
			},
		})
	}
	toggleAbout = () => {
		this.setState({
			hovered:{
				about: !this.state.hovered.about
			}
		})
	}
	onInfoHoverMessage = (type) => {
		switch(type) {
			case 'new':
				this.showInfo(this.onNavigationIconHoverMessages.newMessage.message,this.onNavigationIconHoverMessages.newMessage.keyboardShortcut)
				break;
			case 'save': 
				this.showInfo(this.onNavigationIconHoverMessages.saveMessage.message,this.onNavigationIconHoverMessages.saveMessage.keyboardShortcut)
				break;
			case 'fork':
				this.showInfo(this.onNavigationIconHoverMessages.forkMessage.message,this.onNavigationIconHoverMessages.forkMessage.keyboardShortcut)
				break;
			case 'raw':
				this.showInfo(this.onNavigationIconHoverMessages.viewRawDate.message,this.onNavigationIconHoverMessages.viewRawDate.keyboardShortcut)
				break
			case 'copy':
				this.showInfo(this.onNavigationIconHoverMessages.copyMessage.message,this.onNavigationIconHoverMessages.copyMessage.keyboardShortcut)	
				break
			default:
		}
	}
	
	render() {
 		return (
			<>
				<div id="header">
					<div id="info" ref="info" style={this.state.hovered.info ? {display: 'block'} : {display: 'none'}}></div>
					<div id="about"  style={this.state.hovered.about ? {display: 'block'} : {display: 'none'}}   >		
						<p>ybin is a <span className="accent">private</span> pastebin.</p>
						<p>We do not know what you paste.</p>
						<p>All data is <span className="accent">encrypted</span> on our servers and we <span className="accent">never</span> store your key or info.</p>
					</div>
				
					<div className="logo" onMouseEnter={this.toggleAbout} onMouseLeave={this.toggleAbout}>
						<a href="http://zx.rs/7/ybin---paste-data-privately/" target="_blank"><span className="accent">y</span>bin</a>
					</div>
					<nav>
						<a  onMouseEnter={()=>this.onInfoHoverMessage('new')} onMouseLeave={this.hideInfo} className="fa-file-text fa" id="new" onClick={this.new}></a>
						<a  onMouseEnter={()=>this.onInfoHoverMessage('save')} onMouseLeave={this.hideInfo}  className={this.state.disabled.save ? ' fa-floppy-o fa disabled':' fa-floppy-o fa'} id="save" onClick={this.save}></a>
						<a  onMouseEnter={()=>this.onInfoHoverMessage('fork')} onMouseLeave={this.hideInfo} className={this.state.disabled.fork ? ' fa-pencil fa disabled':' fa-pencil fa'} id="fork" onClick={this.fork}></a>
						<a  onMouseEnter={()=>this.onInfoHoverMessage('raw')} onMouseLeave={this.hideInfo} className={this.state.disabled.raw?' fa-file-code-o fa disabled':' fa-file-code-o fa'} id="raw" onClick={this.raw}></a>
						<a  onMouseEnter={()=>this.onInfoHoverMessage('copy')} onMouseLeave={this.hideInfo} className={this.state.disabled.copy?' fa-clipboard fa disabled':' fa-clipboard fa'} id="copy" onClick={this.copy}></a>
					</nav>
					<div className={this.state.showStatus?'status alert-shown':'status alert-hidden'} ref="status"></div>
				</div>
				<div id="textarea-container">
					<textarea ref="textarea" className="scroller" spellCheck="false" disabled={this.state.disabled.paste}></textarea>
				</div>
			</>
		)}
	}
