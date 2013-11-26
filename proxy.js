// Copyright (c) 2013 Tom Zhou<iwebpp@gmail.com>

var WEBPP = require('iwebpp.io'),
    SEP = WEBPP.SEP,
    vURL = WEBPP.vURL,
    URL = require('url'),
    NET = require('net'),
    httpps = require('httpps');


// helpers
function isLocalhost(host){
    return ((host === 'localhost') || (host === '127.0.0.1') ||
            (host === '0:0:0:0:0:0:0:1') || (host === '::1'));
}

// Debug level
var Debug = 0;

// Proxy class
// a proxy will contain one iwebpp.io name-client
// - options: user custom parameters, like {secmode: ..., usrkey: ..., domain: ..., endpoints: ..., turn: ...}
// - options.secmode: ssl, enable ssl/https; acl, enable ssl/https,host-based ACL
// - options.export: Forward-proxy's Export service vURL
// - options.access_local: Enable local access on Export host, 1: enable, 0: disable, default disable it
// -      fn: callback to pass proxy informations
var Proxy = module.exports = function(options, fn){ 
    var self = this;
       
    if (!(this instanceof Proxy)) return new Proxy(options, fn);
    
    if (typeof options == 'function') {
        fn = options;
        options = {};
    }
    
    // check arguments
    self.access_local = options.access_local || 0;
        
    // 0.
    // export proxy cache
    self.exportCache = {};
    
    // fill dedicated export proxy
    self.exportCache.gagent = options && options.export;

    // 1.
    // create name client
    var nmcln = self.nmcln = new WEBPP({
        usrinfo: {
            domain: (options && options.domain) || '51dese.com',
            usrkey: (options && options.usrkey) || ('forward-proxy@'+Date.now())
        },
        
        srvinfo: {
            timeout: 20,
            endpoints: (options && options.endpoints) || [
                {ip: 'peerwww.net', port: 51686},
                {ip: 'peerwww.net', port: 51868}
            ],
            turn: (options && options.turn) || [
                {ip: 'peerwww.net', agent: 51866, proxy: 51688}
            ]
        },
        
        // vURL mode: vhost-based
        vmode: vURL.URL_MODE_HOST, 
        
        // secure mode
        secmode: (options && options.secmode === 'ssl') ? SEP.SEP_SEC_SSL : SEP.SEP_SEC_SSL_ACL_HOST
    });
	
	// 2.
	// check ready
	nmcln.once('ready', function(){      	    	    
	    // 3.
	    // export http proxy
	    // TBD... admin portal page
	    function exportHttpProxy(req, res){
            res.writeHead(400);
            res.end('TBD... admin portal page');
            console.error('TBD... admin portal page');
	    }
	    
	    // 3.1
	    // export http tunnel
	    var exportHttpTunnel = function(req, socket, head){
	        // 6.1
	        // find next hop in case middle
	        // TBD...
	        if (0) {
	        
	        } else {
	            // reach export
	            var urls    = URL.parse('http://'+req.url, true, true);
	            var srvip   = urls.hostname;
	            var srvport = urls.port || 443;
	            
	            // check if access to export local host
	            if ((self.access_local === 0) && isLocalhost(srvip)) {
                    console.log("http tunnel proxy to " + req.url + ", deny local access on export host");
                    socket.end();
                    return;
	            }
	            
                if (Debug) console.log('http tunnel proxy, connect to %s:%d', srvip, srvport);
                var srvSocket = NET.connect(srvport, srvip, function() {
                    if (Debug) console.log('http tunnel proxy, got connected!');   
                    
                    ///srvSocket.write(head); 
				    socket.pipe(srvSocket);
				        
				    socket.write('HTTP/1.1 200 Connection Established\r\n' +
				                 'Proxy-agent: Node-Proxy\r\n' +
				                 '\r\n');
				    srvSocket.pipe(socket);
                });
  
				srvSocket.setNoDelay(true);
				    
				srvSocket.on('error', function(e) {
				    console.log("http tunnel proxy to " + req.url + ", socket error: " + e);
				    socket.end();
				});
	        }
	    };
	    	    
	    // 5.
	    // import http proxy
	    function importHttpProxy(req, res){
	    	var vurle, vstrs, urle = req.url;
		    
		    if (Debug) console.log('proxy to '+urle+',headers:'+JSON.stringify(req.headers));
		    
		    function resErr(err){
		        try {
			        res.writeHead(500);
					res.end(err);
				} catch (e) {
				    console.log('res.end exception '+e);
				}
		    }
		    
		    // 0.
		    // find next hop
		    
		    		    
		    // 1.
		    // match vURL pattern:
		    // - vhost like http(s)://"xxx.vurl."vlocal.peerwww.net
		    // - vpath like http(s)://vlocal.peerwww.net"/vurl/xxx"
		    if (vstrs = req.headers.host.match(vURL.regex_vhost)) {
		        vurle = vstrs[0];
		        if (Debug) console.log('proxy for client with vhost:'+vurle);
		    } else if (vstrs = urle.match(vURL.regex_vpath)) {
			    vurle = vstrs[0];	       
			    
			    // prune vpath in req.url
	            req.url = req.url.replace(vurle, '');
			    
			    // prune /vlocal/wxxxp path
	            // TBD ... cascade routing
	            req.url = req.url.replace(vpathwpregex, '');
	                 
			    if (Debug) console.log('proxy for client with vpath:'+vurle);
		    } else if (vurle = self.exportCache.gagent) {
		        if (Debug) console.log('use dedicated export proxy');
		    } else {
		        // not reachable
                resErr('not reachable');
                console.error('not reachable:'+urle);
                                
                return;
		    }
		    
		    if (Debug) console.log('tunnel proxy for client request.headers:'+JSON.stringify(req.headers)+
		                           ',url:'+urle+',vurl:'+vurle);
		                           
		    // 1.1
	        // !!! rewrite req.url to remove vToken parts
	        // TBD ... vToken check
	        req.url = req.url.replace(vURL.regex_vtoken, '');                      
		    
		    // 2.
			// get peer info by vURL
		    nmcln.getvURLInfo(vurle, function(err, routing){
		        // 2.1
		        // check error and authentication 
		        if (err || !routing) {
		            // invalid vURL
	                resErr('invalid URL');
	                console.error('invalid URL:'+urle);
	                                
	                return;
		        } else {
			        // 3.
			        // get peer endpoint
	                var dstip, dstport;
	                
	                if ((nmcln.oipaddr === routing.dst.ipaddr) || 
	                    (isLocalhost(nmcln.oipaddr) && isLocalhost(routing.dst.ipaddr))) {
	                    dstip   = routing.dst.lipaddr;
	                    dstport = routing.dst.lport;
	                } else {
	                    dstip   = routing.dst.ipaddr;
	                    dstport = routing.dst.port;
	                }
			        		    
			        // 5.
			        // traverse STUN session to peer
			        nmcln.trvsSTUN(vurle, function(err, stun){
			            if (err || !stun) {
				            // STUN not availabe
		                    resErr('STUN not available, please use TURN');
		                    console.error('STUN not available:'+urle);
			            } else {
			                // 6.
						    // setup tunnel to target by make CONNECT request
						    var roptions = {
							        port: dstport,
							    hostname: dstip,
							      method: 'CONNECT',
							        path: (/(:\d+)$/gi).test(req.headers.host) ? req.headers.host : req.headers.host+':80',
							       agent: false,
							        
							    // set user-specific feature,like maxim bandwidth,etc
			                    localAddress: {
			                        addr: nmcln.ipaddr,
			                        port: nmcln.port, 
			                        
			                        opt: {
			                            mbw: options.mbw || null
			                        }
			                    }
					        };
					        // set SSL related options
						    if (nmcln.secmode && nmcln.secerts) {
						        Object.keys(nmcln.secerts).forEach(function(k){
						            roptions[k] = nmcln.secerts[k];  
						        });
						    }
						    							
							var rreq = httpps.request(roptions);
							rreq.end();
							rreq.on('error', function(e) {
						        console.log("tunnel proxy, CONNECT request error: " + e);					        
						        resErr("tunnel proxy, CONNECT request error: " + e);
						    });
						    
							if (Debug) console.log('tunnel proxy, connect to %s:%d', dstip, dstport);
							rreq.on('connect', function(rres, rsocket, rhead) {
							    if (Debug) console.log('tunnel proxy, got connected');
							
							    rsocket.on('error', function(e) {
							        console.log("tunnel proxy, socket error: " + e);
							        resErr("tunnel proxy, socket error: " + e);
							    });
							    
							    // request on tunnel connection
							    var toptions = {
								              method: req.method,
								                path: req.url.match(/^(http:)/gi)? URL.parse(req.url).path : req.url,
								               agent: false,
								               
								             // set headers
								             headers: req.headers,
								             
								    // pass rsocket which's request on           
								    createConnection: function(port, host, options){
								        return rsocket
								    } 
						        };
								
								var treq = httpps.request(toptions, function(tres){
								    if (Debug) console.log('tunnel proxy, got response, headers:'+JSON.stringify(tres.headers));
								    
								    // set headers
								    Object.keys(tres.headers).forEach(function (key) {
								      res.setHeader(key, tres.headers[key]);
								    });
								    res.writeHead(tres.statusCode);
								    
								    tres.pipe(res);
								    
								    tres.on('error', function(e) {
							            console.log("tunnel proxy, tunnel response error: " + e);					        
							            resErr("tunnel proxy, tunnel response error: " + e);
						            });
								});
								treq.on('error', function(e) {
							        console.log("tunnel proxy, tunnel request error: " + e);					        
							        resErr("tunnel proxy, tunnel request error: " + e);
						        });
								req.pipe(treq);
								req.on('error', resErr);
								req.on('aborted', function () {
								    treq.abort();
								});
								if (req.trailers) {
								    treq.end();
								}
							});
			            }
			        });		        
		        }
	        });
	    }
	    
	    // 5.1
	    // import http tunnel proxy based on CONNECT method
	    function importHttpTunnel(req, socket, head) {
		    var vurle, vstrs, urle = req.url;
		    
		    if (Debug) console.log('tunnel to '+urle);
		    
		    // 0.
		    // find next hop
		    
		    
		    // 1.
		    // match vURL pattern:
		    // - vhost like http(s)://"xxx.vurl."vlocal.peerwww.net
		    // - vpath like http(s)://vlocal.peerwww.net"/vurl/xxx"
		    if (vstrs = urle.match(vURL.regex_vhost)) {
		        vurle = vstrs[0];
		        if (Debug) console.log('tunnel for client with vhost:'+vurle);
		    } else if (vstrs = urle.match(vURL.regex_vpath)) {
			    vurle = vstrs[0];	       
			    
			    // prune vpath in req.url
	            req.url = req.url.replace(vurle, '');
			    
			    // prune /vlocal/wxxxp path
	            // TBD ... cascade routing
	            req.url = req.url.replace(vpathwpregex, '');
	                 
			    if (Debug) console.log('proxy for client with vpath:'+vurle);
		    } else if (vurle = self.exportCache.gagent) {
		        if (Debug) console.log('use dedicated export proxy');
		    } else {
		        // not reachable
                socket.end('not reachable');
                console.error('not reachable:'+urle);
                                
                return;
		    }
		    
		    if (Debug) console.log('tunnel proxy for client request.headers:'+JSON.stringify(req.headers)+
		                           ',url:'+urle+',vurl:'+vurle);
		                           
		    // 1.1
	        // !!! rewrite req.url to remove vToken parts
	        // TBD ... vToken check
	        req.url = req.url.replace(vURL.regex_vtoken, '');                      
		    
		    // 2.
			// get peer info by vURL
		    nmcln.getvURLInfo(vurle, function(err, routing){
		        // 2.1
		        // check error and authentication 
		        if (err || !routing) {
		            // invalid vURL
	                socket.end('invalid URL');
	                console.error('invalid URL:'+urle);
	                                
	                return;
		        } else {
			        // 3.
			        // get peer endpoint
	                var dstip, dstport;
	                
	                if ((nmcln.oipaddr === routing.dst.ipaddr) || 
	                    (isLocalhost(nmcln.oipaddr) && isLocalhost(routing.dst.ipaddr))) {
	                    dstip   = routing.dst.lipaddr;
	                    dstport = routing.dst.lport;
	                } else {
	                    dstip   = routing.dst.ipaddr;
	                    dstport = routing.dst.port;
	                }
			        		    
			        // 5.
			        // traverse STUN session to peer
			        nmcln.trvsSTUN(vurle, function(err, stun){
			            if (err || !stun) {
				            // STUN not availabe
		                    socket.end('STUN not available, please use TURN');
		                    console.error('STUN not available:'+urle);
			            } else {
			                // 6.
						    // setup tunnel to target by make CONNECT request
						    var roptions = {
							        port: dstport,
							    hostname: dstip,
							      method: 'CONNECT',
							        path: req.url,
							       agent: false,
							        
							    // set user-specific feature,like maxim bandwidth,etc
			                    localAddress: {
			                        addr: nmcln.ipaddr,
			                        port: nmcln.port, 
			                        
			                        opt: {
			                            mbw: options.mbw || null
			                        }
			                    }
					        };
					        // set SSL related options
						    if (nmcln.secmode && nmcln.secerts) {
						        Object.keys(nmcln.secerts).forEach(function(k){
						            roptions[k] = nmcln.secerts[k];  
						        });
						    }
						    							
							var rreq = httpps.request(roptions);
							rreq.end();
							
							if (Debug) console.log('tunnel proxy, connect to %s:%d', dstip, dstport);
							rreq.on('connect', function(rres, rsocket, rhead) {
							    if (Debug) console.log('tunnel proxy, got connected');
							
							    socket.write('HTTP/1.1 200 Connection Established\r\n' +
							                 'Proxy-agent: Node-Proxy\r\n' +
								             '\r\n');
								
								rsocket.pipe(socket);
								socket.pipe(rsocket);
								
							    rsocket.on('error', function(e) {
							        console.log("tunnel proxy, socket error: " + e);
							        socket.end();
							    });
							});
							
							rreq.on('error', function(e) {
						        console.log("tunnel proxy, CONNECT request error: " + e);					        
						        socket.end();
						    });
			            }
			        });		        
		        }
	        });
	    }	    
        
	    // 5.2
	    // import socks proxy
	    function importSocksProxy(socket, port, address, proxy_ready) {
		    var vurle, vstrs, urle = address+':'+port;
		    
		    if (Debug) console.log('socks proxy to '+urle);
		    
		    // 1.
		    // find next hop
		    // TBD...
		    if (vstrs = urle.match(vURL.regex_vhost)) {
		        vurle = vstrs[0];
		        if (Debug) console.log('tunnel for client with vhost:'+vurle);
		    } else if (vurle = self.exportCache.gagent) {
		        if (Debug) console.log('use dedicated export proxy');
		    } else {
		        // not reachable
                socket.end('not reachable');
                console.error('not reachable:'+urle);
                                
                return;
		    }
		    
		    if (Debug) console.log('socks proxy for client'+
		                           ',url:'+urle+',vurl:'+vurle);
		                   
		    // 2.
			// get peer info by vURL
		    nmcln.getvURLInfo(vurle, function(err, routing){
		        // 2.1
		        // check error and authentication 
		        if (err || !routing) {
		            // invalid vURL
	                socket.end('invalid URL');
	                console.error('invalid URL:'+urle);
	                                
	                return;
		        } else {
			        // 3.
			        // get peer endpoint
	                var dstip, dstport;
	                
	                if ((nmcln.oipaddr === routing.dst.ipaddr) || 
	                    (isLocalhost(nmcln.oipaddr) && isLocalhost(routing.dst.ipaddr))) {
	                    dstip   = routing.dst.lipaddr;
	                    dstport = routing.dst.lport;
	                } else {
	                    dstip   = routing.dst.ipaddr;
	                    dstport = routing.dst.port;
	                }
			        		    
			        // 5.
			        // traverse STUN session to peer
			        nmcln.trvsSTUN(vurle, function(err, stun){
			            if (err || !stun) {
				            // STUN not availabe
		                    socket.end('STUN not available, please use TURN');
		                    console.error('STUN not available:'+urle);
			            } else {
			                // 6.
						    // setup tunnel to target by make CONNECT request
						    var roptions = {
							        port: dstport,
							    hostname: dstip,
							      method: 'CONNECT',
							        path: urle,
							       agent: false,
							        
							    // set user-specific feature,like maxim bandwidth,etc
			                    localAddress: {
			                        addr: nmcln.ipaddr,
			                        port: nmcln.port, 
			                        
			                        opt: {
			                            mbw: options.mbw || null
			                        }
			                    }
					        };
					        // set SSL related options
						    if (nmcln.secmode && nmcln.secerts) {
						        Object.keys(nmcln.secerts).forEach(function(k){
						            roptions[k] = nmcln.secerts[k];  
						        });
						    }
							
							var rreq = httpps.request(roptions);
							rreq.end();
							
							if (Debug) console.log('socks proxy, connect to %s:%d', dstip, dstport);
							rreq.on('connect', function(rres, rsocket, rhead) {
							    if (Debug) console.log('socks proxy, got connected');
							
							    // send socks response      
							    proxy_ready();
								
								rsocket.pipe(socket);
								socket.pipe(rsocket);
								
							    rsocket.on('error', function(e) {
							        console.log("socks proxy, socket error: " + e);
							        socket.end();
							    });
							});
							
							rreq.on('error', function(e) {
						        console.log("socks proxy, CONNECT request error: " + e);					        
						        socket.end();
						    });
			            }
			        });		        
		        }
	        });
	    }
	    
    	// 6.
        // report peer-service
        // like {vurl:x,cate:x,name:x,desc:x,tags:x,acls:x,accounting:x,meta:x}
        nmcln.reportService({
            vurl: nmcln.vurl,
            cate: 'forward-proxy',
            name: 'forward-proxy'
        });
        
        // 6.1
        // update peer-service: connetion loss, etc
        // TBD...
        
        // 8.
	    // pass forward proxy App
	    fn(null, {
	        importApp: {httpApp: {tunnel: importHttpTunnel, proxy: importHttpProxy}, socksApp: importSocksProxy},
	        exportApp: {httpApp: {tunnel: exportHttpTunnel, proxy: exportHttpProxy}}
	    });
	});
	
	// 1.2
	// check error
	nmcln.on('error', function(err){
	    console.log('name-client create failed:'+JSON.stringify(err));
	    fn(err);
	});
};

