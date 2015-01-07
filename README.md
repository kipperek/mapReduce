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

var threads = [];
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

Przykładowy wynik:

```javascript
{
	"_id" : "anna",
	"value" : 3
}
```

## MapReduce 2

### Opis

Zliczanie ilości epizodów każdego z filmów.

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

var threads = [];
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
	"timeMillis" : 1850219,
	"counts" : {
		"input" : 19831300,
		"emit" : 19831300,
		"reduce" : 54850,
		"output" : 54850
	},
	"ok" : 1
}
```

Przykładowy wynik:

```javascript
{
	"_id" : "$100 Makeover",
	"value" : 3
}
```

## MapReduce 3

### Opis

Zmapowanie wszystkich tytułów (wartości unikalnych) do tablic według typu filmu.

### Skrypt

```javascript
print("ENSURING INDEX");
db.movies.ensureIndex({title: 1});

var res = db.runCommand({splitVector: "mapreduce.movies", keyPattern: {title: 1}, maxChunkSizeBytes: 32 *1024 * 1024 });

var keys = res.splitKeys;

var mapred = function(min, max) { 

	map = function () {
		var value = { names: [ this.title ] };
	  	emit(this.modelName, value);
	};

	reduce = function(key, values) {

		var a = values.reduce(function(acc, x) {
	    return acc.concat(x.names);
	  	}, []);

		var seen = {};
		unq = a.filter(function(item) {
	        return seen.hasOwnProperty(item) ? false : (seen[item] = true);
	    });

		return { names: unq };
	};

	finalize = function(key, value){
		return value.names;
	};

	var rand = parseInt(Math.random()*100000);

	return db.runCommand({ 
        mapreduce: "movies", 
        map: map, 
        reduce: reduce, 
        finalize: finalize,
        out: { replace: "tags" + rand, db: "db" + rand }, 
        sort: {title: 1}, 
        query: { title: { $gte: min, $lt: max } },
        jsMode: true  
	}); 
}


var threads = [];
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
		"db" : "db12986",
		"collection" : "tags12986"
	},
	"timeMillis" : 1656228,
	"counts" : {
		"input" : 19831300,
		"emit" : 19831300,
		"reduce" : 5,
		"output" : 5
	},
	"ok" : 1
}
```

Przykładowy wynik:

```javascript
{
        "_id" : null,
        "value" : [
                "The Office",
                "Lost Tapes",
                "The Avengers: Earth's Mightiest Heroes",
                "The Ellen DeGeneres Show",
                "Law & Order: Special Victims Unit",
                "The Smurfs",
                "Parks and Recreation",
                "Final Destination 5",
                "Breaking Bad",
                "Royal Pains",
                "Law & Order: Los Angeles",
                "Diggstown",
                "Zombie Hamlet",
                "Them!",
                "Robin and the 7 Hoods",
                "Doghouse",
                "The Dresden Files",
                "Ghost Adventures",
                "Leverage",
                "The Vampire Diaries",
                "Despicable Me",
                "How I Met Your Mother",
                "Scott Pilgrim vs. The World",
                "Priest",
                "Doug",
                "Ghosts of Girlfriends Past",
                "The Devil's Double",
                "Thor",
                "Glee: The 3-D Concert Movie",
                "New Zealand's Next Top Model",
                "Archer",
                "Wilfred",
                "L.A. Ink",
                "From Russia With Love",
                "Project Runway",
                "Don't Be Afraid of the Dark",
                "Kick Ass",
                "Captain America",
                "The West Wing",
                "Bridesmaids",
                "Boy Meets World"
        ]
}
```

## MapReduce 4

### Opis

Zliczenie wszystkich słów wystepujących w tytułach filmów

### Skrypt

```javascript
print("ENSURING INDEX");
db.movies.ensureIndex({title: 1});

var res = db.runCommand({splitVector: "mapreduce.movies", keyPattern: {title: 1}, maxChunkSizeBytes: 32 *1024 * 1024 });

var keys = res.splitKeys;

var mapred = function(min, max) { 

	map = function () {
	  	this.title.split(' ').forEach(function(word) {
		    emit(word, 1);
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
        out: { replace: "words" + rand, db: "db" + rand }, 
        sort: {title: 1}, 
        query: { title: { $gte: min, $lt: max } },
        jsMode: true  
	}); 
}

var threads = [];
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
		"db" : "db25987",
		"collection" : "words25987"
	},
	"timeMillis" : 68521163,
	"counts" : {
		"input" : 19831300,
		"emit" : 158650400,
		"reduce" : 358586,
		"output" : 358586
	},
	"ok" : 1
}
```

Przykładowy wynik:

```javascript
{
        "_id" : "Til",
        "value" : 1162
}
```