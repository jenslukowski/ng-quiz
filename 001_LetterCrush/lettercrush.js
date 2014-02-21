var module = angular.module("LetterCrush", []);

// FileReader service
// adapted from http://odetocode.com/blogs/scott/archive/2013/07/03/building-a-filereader-service-for-angularjs-the-service.aspx
module.factory('fileReader', function($q, $log) {
  var onLoad = function(reader, deferred, scope) {
    return function () {
      scope.$apply(function () {
        deferred.resolve(reader.result);
      });
    };
  };
  var onError = function (reader, deferred, scope) {
    return function () {
      scope.$apply(function () {
        deferred.reject(reader.result);
      });
    };
  };
  var onProgress = function(reader, scope) {
    return function (event) {
      scope.$broadcast("fileProgress", {
                        total: event.total,
                        loaded: event.loaded
                      });
    };
  };
  var getReader = function(deferred, scope) {
    var reader = new FileReader();
    reader.onload = onLoad(reader, deferred, scope);
    reader.onerror = onError(reader, deferred, scope);
    reader.onprogress = onProgress(reader, scope);
    return reader;
  };
  var readAsText = function (file, scope) {
    var deferred = $q.defer();
            
    var reader = getReader(deferred, scope);         
    reader.readAsText(file);
            
    return deferred.promise;
  };

  return {readAsText: readAsText};
});

module.factory('letterGenerator', function($q, $log) {
    var frequencies = [8.167,1.492,2.782,4.253,12.702,2.228,2.015,6.094,6.966,0.153,0.772,4.025,2.406,6.749,7.507,1.929,0.095,5.987,6.327,9.056,2.758,0.978,2.360,0.150,1.974,0.074];
    var codeA = 65;
    var newLetter = function() {
        var frequency = Math.random() * 100;
        for (var i = 0; i < frequencies.length; i++) {
            frequency -= frequencies[i];
            if (frequency <= 0) {
                return String.fromCharCode(codeA + i);
            }
        }
        return 'Z';
    };
    return {newLetter: newLetter};
});

module.factory('wordFinder', function($q, $log) {
  var insideBoard = function(board, row, column) {
    return row >= 0 && column >= 0 && row < board.length && column < board[row].length;
  };
  var neighboursOf = function(cell) {
    return [
      [cell[0] - 1, cell[1] - 1], [cell[0] - 1, cell[1]], [cell[0] - 1, cell[1] + 1],
      [cell[0],     cell[1] - 1],                         [cell[0],     cell[1] + 1],
      [cell[0] + 1, cell[1] - 1], [cell[0] + 1, cell[1]], [cell[0] + 1, cell[1] + 1]
    ];
  };
  var contains = function(array, e) {
    for (var i = 0; i < array.length; i++) {
      if (e[0] === array[i][0] && e[1] === array[i][1]) {
        return true;
      }
    }
    return false;                        
  };
  var findNextLetter = function(board, word, path) {
    if (word.length === 0) {
      return path;
    }
    var position = path[path.length - 1];
    var neighbours = neighboursOf(position);
    for (var i = 0; i < neighbours.length; i++) {
      var neighbour = neighbours[i];
      if (!insideBoard(board, neighbour[0], neighbour[1])) {
        continue;
      }
      if (contains(path, neighbour)) {
        continue;
      }
      if (word.charAt(0).toUpperCase() === board[neighbour[0]][neighbour[1]]) {
        var foundPath = findNextLetter(board, word.slice(1), path.concat([neighbour]));
        if (foundPath) {
          return foundPath;
        }
      }
    }
    return null;
  };
  var find = function(board, word) {
    var foundPath;
    angular.forEach(board, function(row, i) {
      angular.forEach(row, function(column, j) {
        if (word.charAt(0).toUpperCase() === column) {
          var path = findNextLetter(board, word.slice(1), [[i, j]]);
          if (path) {
            foundPath = path;
          }
        }
      });
    });
    return foundPath;
  };

  return {find: find};
});

module.factory('util', function($q, $log) {
  var containsIgnoreCase = function(array, e) {
    for (var i = 0; i < array.length; i++) {
      if (e.toUpperCase() === array[i].toUpperCase()) {
        return true;
      }
    }
  return false;                        
  };
  var fib = function(n) {
    if (n === 0) {
      return 0;
    }
    if (n === 1) {
      return 1;
    }
    return fib(n - 1) + fib(n - 2);
  };
  return {containsIgnoreCase: containsIgnoreCase, fib: fib};
});

module.factory('dictionary', ['fileReader', 'util', function(fileReader, util) {
  var dictionary = [];
  var init = function(scope) {
    var getFile = function (evt) {
      fileReader.readAsText(evt.target.files[0], scope).then(function(result) {
        dictionary = result.split("\n");
      });
    };
    document.getElementById('dictionary').addEventListener('change', getFile, false);
  };
  var containsWord = function(w) {
    return util.containsIgnoreCase(dictionary, w);
  };
  var isEmpty = function() {
    return dictionary.length === 0;
  };
  return {init: init, containsWord: containsWord, isEmpty: isEmpty};
}]);

module.factory('board', ['letterGenerator', 'wordFinder', function(letterGenerator, wordFinder) {
  var content = [];
  var init = function(boardSize) {
    for (var lineNo = 0; lineNo < boardSize; lineNo++) {
      var line = [];
      for (var count = 0; count < boardSize; count++) {
        line.push(letterGenerator.newLetter());
      }
      content.push(line);
    }
  };
  var fall = function() {
    for (var i = content.length - 1; i > 0; i--) {
      for (var j = 0; j < content[i].length; j++) {
        if (content[i][j] === '') {
          for (var k = i - 1; k >= 0; k--) {
            if (content[k][j] !== '') {
              content[i][j] = content[k][j];
              content[k][j] = '';
              break;
            }
          }
        }
      }
    }
  };
  var fillEmpty = function() {
    angular.forEach(content, function(row, i) {
      angular.forEach(row, function(column, j) {
        if (column === '') {
          content[i][j] = letterGenerator.newLetter();
        }
      });
    });
  };
  var clear = function(path) {
    angular.forEach(path, function(pos, i) {
      content[pos[0]][pos[1]] = '';
    });
    fall();
    fillEmpty();
  };
  var find = function(word) {
    return wordFinder.find(content, word);
  };
  return {content: content, init: init, clear: clear, find: find};
}]);


module.controller('LetterCrush', ['$scope', 'board', 'dictionary', 'util',
                  function ($scope, board, dictionary, util) {
    var penalty = 1;

    $scope.score = 0;
    $scope.board = board;
    board.init(5);
    
    dictionary.init($scope);
    
    $scope.testWord = function() {
      if (dictionary.isEmpty()) {
        alert('Please specify a dictionary file.');
        return;
      }
      if (!dictionary.containsWord($scope.word)) {
        $scope.score -= penalty;
        alert($scope.word + ' is no word.');
        $scope.word = '';
        return;
      }
      var found = $scope.board.find($scope.word);
      if (!found) {
        $scope.score -= penalty;
        alert($scope.word + ' is not on the board.');
        $scope.word = '';
        return;
      }
      $scope.score += $scope.calculateScore(found.length);
      $scope.word = '';
      $scope.board.clear(found);
    };
    $scope.calculateScore = function(len) {
        return util.fib(len);
    };
}]);
