map = function () {
	if(this.title.match(/^ka/i))
  		emit({title: this.title}, {count: 1});
};

reduce = function(key, values) {
  var counter = 0;
  values.forEach(function(value) {
    counter += value.count;
  });
  return {count: counter};
};
db.movies.mapReduce(map, reduce, {out: "first"});