# Map Reduce

Dane: [movies and tv shows](http://getglue-data.s3.amazonaws.com/getglue_sample.tar.gz)

```javascript
> db.movies.count()
19831300
> db.movies.findOne()
db.movies.findOne()
{
        "_id" : ObjectId("548f427a2f5cd76394a5d4d2"),
        "comment" : "",
        "hideVisits" : "false",
        "modelName" : "tv_shows",
        "displayName" : "",
        "title" : "Criminal Minds",
        "timestamp" : "2008-08-01T06:58:14Z",
        "image" : "http://cdn-1.nflximg.com/us/boxshots/large/70056671.jpg",
        "userId" : "areilly",
        "private" : "false",
        "source" : "http://www.netflix.com/Movie/Criminal_Minds_Season_1/70056671",
        "version" : "2",
        "link" : "http://www.netflix.com/Movie/Criminal_Minds_Season_1/70056671",
        "lastModified" : "2011-12-16T19:41:19Z",
        "action" : "Liked",
        "lctitle" : "criminal minds",
        "objectKey" : "tv_shows/criminal_minds",
        "visitCount" : "1"
}
```

Map reduce zostały przyśpieszone według [poradnika](http://edgystuff.tumblr.com/post/54709368492/how-to-speed-up-mongodb-map-reduce-by-20x)

## MapReduce 1

---

### Opis

Wyszukanie wszystkich palindormów w tytułach filmów i zliczenie ich występowania.

### Skrypt

```javascript
print("ENSURING INDEX");
db.movies.ensureIndex({title: 1});

var res = db.runCommand({splitVector: "mapreduce.movies", keyPattern: {title: 1}, maxChunkSizeBytes: 32 *1024 * 1024 });

var keys = res.splitKeys;

var mapred = function(min, max) { 

        map = function () {
                 var palindrome = function(string){
                        var reverse = string.split('').reverse().join('');

                        return string === reverse;
                }
                
                var words = this.title.split(' ');
                words.forEach(function(word){
                        if(palindrome(word)){
                            emit(word, 1);
                        }
                });

        };

        reduce = function(key, values) {
                var counter = 0;
                values.forEach(function(value) {
                counter += value;
                });

                return counter;
        };

        var rand = parseInt(Math.random()*100000);

        return db.runCommand({ 
                mapreduce: "movies", 
                map: map, 
                reduce: reduce, 
                out: { replace: "palindromesCol" + rand, db: "db" + rand }, 
                sort: {title: 1}, 
                query: { title: { $gte: min, $lt: max } },
                jsMode: true  
        }); 
}

threads = [];
var numThreads = 4;
var inc = Math.floor(keys.length / numThreads);

print("RUNNING THREADS");
for (var i = 0; i < numThreads; ++i) { 
        var min = (i == 0) ? MinKey : keys[i * inc].title; 
        var max = (i == numThreads-1) ? MaxKey : keys[inc * (i+1)].title;
        max = (i == 0) ? keys[inc].title : max;
        var t = new ScopedThread(mapred, min, max); 
        threads.push(t); 
        t.start(); 
}
for (var i in threads) {
        var t = threads[i]; 
        t.join(); 
        printjson(t.returnData()); 
}
```

### Wynik

```javascript
{
"result" : {
	"db" : "db76841",
	"collection" : "palindromesCol76841"
},
"timeMillis" : 43205821,
"counts" : {
	"input" : 19831300,
	"emit" : 5,
	"reduce" : 2,
	"output" : 2
},	
"ok" : 1
}
```

```javascript
{
	"_id" : "anna",
	"value" : 3
},
{
	"_id" : "bob",
	"value" : 2
}
```

## MapReduce 2

---

### Opis

Zliczanie ilości epizodów każdego z filmów

### Skrypt

```javascript
print("ENSURING INDEX");
db.movies.ensureIndex({title: 1});

var res = db.runCommand({splitVector: "mapreduce.movies", keyPattern: {title: 1}, maxChunkSizeBytes: 32 *1024 * 1024 });

var keys = res.splitKeys;

var mapred = function(min, max) { 

	map = function () {
	  	emit(this.title, 1);
	};

	reduce = function(key, values) {
	  var counter = 0;
	  values.forEach(function(value) {
	    counter += value;
	  });
	  return counter;
	};

 	var rand = parseInt(Math.random()*100000);

    return db.runCommand({ 
            mapreduce: "movies", 
            map: map, 
            reduce: reduce, 
            out: { replace: "epizode" + rand, db: "db" + rand }, 
            sort: {title: 1}, 
            query: { title: { $gte: min, $lt: max } },
            jsMode: true  
    }); 
}

threads = [];
var numThreads = 4;
var inc = Math.floor(keys.length / numThreads);

print("RUNNING THREADS");
for (var i = 0; i < numThreads; ++i) { 
        var min = (i == 0) ? MinKey : keys[i * inc].title; 
        var max = (i == numThreads-1) ? MaxKey : keys[inc * (i+1)].title;
        max = (i == 0) ? keys[inc].title : max;
        var t = new ScopedThread(mapred, min, max); 
        threads.push(t); 
        t.start(); 
}
for (var i in threads) {
        var t = threads[i]; 
        t.join(); 
        printjson(t.returnData()); 
}
```

### Wynik

```javascript
{
"result" : {
	"db" : "db36955",
	"collection" : "epizode36955"
},
"timeMillis" : 185021984,
"counts" : {
	"input" : 19831300,
	"emit" : 19831300,
	"reduce" : 54850,
	"output" : 54850
},
"ok" : 1
}
```