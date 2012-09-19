var http = require('http')
var CouchStream = require('couchstream')
var io = require('socket.io')
var st = require('st')

var mount = st({
  path: 'public/'
, url: '/'
, fd: { max: 100, maxAge: 1 }
, stat: { max: 100, maxAge: 1 }
, index: 'index.html'
})

var server = http.createServer(function (req, res) {
  if (mount(req, res)) return
}).listen(8080)

var registry = new CouchStream({
  hostname: 'isaacs.iriscouch.com'
, database: 'registry'
, query: {
    since: 227793 
  , heartbeat: 5000
  }
})

var package_name = '?'
  , package_rev

registry.on('change', function (change) {
  package_name = change.id
  package_rev = change.changes[0].rev
  console.log(package_name)
})

var socket_io = io.listen(server, {log: false}) 

socket_io.on('connection', function (socket) {

    var package_info = (function () {

      var options = {
	host: 'isaacs.iriscouch.com'
      , path: '/registry/' + package_name + '?rev=' + package_rev
      , port: 80
      , method: 'GET'
      }

      var req = http.request(options, function (res) {
	var chunks = []
	var buffer_len = 0
	res.on('data', function (chunk) {
	  chunks.push(chunk)
	  buffer_len += chunk.length
	})

	res.on('end', function () {
	  var concat_buff = new Buffer(buffer_len)
	  var index = 0
	  chunks.forEach(function (val) {
	    val.copy(concat_buff, index, 0, val.length)
	    index += val.length
	  })

	  var body = concat_buff.toString('utf8')
	  var body = JSON.parse(body)
	  var package_meta = {
	    name: package_name
	  , author: '?'
	  }
	  if (body.author && body.author.name) {
	    package_meta.author = body.author.name
	  }
	  else if (body.maintainers) {
	    var maintainers = []
	    body.maintainers.forEach(function (val) {
	      maintainers.push(val.name)
	    })
	    package_meta.author = maintainers.join(' & ')
	  }


          socket.emit('module_update', package_meta)
	  console.log(package_meta)
	})
	
      })

      req.end()

    })()


})
