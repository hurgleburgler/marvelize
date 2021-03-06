// A helper class for the MarvelAPI
function MarvelAPI(request_data, server, path) {
  this.request_data = request_data;
  this.server = server || 'http://gateway.marvel.com:80';
  this.path = path || 'v1/public/characters';
  this.limit_calls = 10;
  this.counter = 0;

  // Just a straight up json call to get data, returning the promise
  this.getData = function(category, params) {
    return $.getJSON(this.getURL(category), $.extend({}, this.request_data, params));
  };

  // The Marvel API limits the number of entries returned by 100, so lets chain them to get all the
  // data available
  this.getAllData = function(category, params, extra_data) {
    var that = this;
    return this.getData(category, params).then(function(response) {
      that.counter++;
      var this_data = response.data;
      extra_data = extra_data || [];
      this_data.results = this_data.results.concat(extra_data);
      if ((this_data.total <= (this_data.count + this_data.offset)) || (that.counter > that.limit_calls)) {
        that.counter = 0;
        response.data.count = response.data.results.length;
        return response;
      } else {
        return that.getAllData(category, $.extend({}, that.request_data, {
          offset: this_data.offset + this_data.count
        }), response.data.results);
      }
    });
  };

  this.getBaseURL = function() {
    return [
      this.server,
      this.path
    ].join('/');
  };

  this.getURL = function(category) {
    var url = [
      this.getBaseURL(),
      _.isObject(this.character) ? this.character.id : this.character
    ].join('/');

    // If we want to refine the data query to the next rest level
    if (category) {
      url = url + '/' + category;
    }
    return url;
  };

  this.parseCharacterData = function (character, data) {
    // Init return value
    var ret_val = {
      nodes: [{
        name: character.name,
        id: character.id,
        image: character.thumbnail ? character.thumbnail.path + '.' + character.thumbnail.extension : '',
        group: 0
      }],
      links: []
    };

    // Short circuit if we don't have anything to parse
    if(!data || $.isEmptyObject(data) || !('data' in data)) {
      return ret_val;
    }
    data = data.data;

    // Loop through and pull out the relevant data
    if('results' in data) {
      for (var ii = 0; ii < data.results.length; ii++) {
        var this_comic = data.results[ii];
        ret_val.nodes.push({
          name: this_comic.title,
          image: this_comic.thumbnail.path + '.' + this_comic.thumbnail.extension,
          group: 0
        });

        // Link him to our main character
        ret_val.links.push({
          target: 0,
          source: ii + 1
        });
      }
    }

    // Return it!
    return ret_val;
  };
}

// Graph creation logic
var graphIt = function(container, json) {
  var $container = $(container).empty();
  var width = $container.width() || 1200,
    height = 800;

  var svg = d3.select(container).append('svg')
    .attr('width', width)
    .attr('height', height);

  var force = d3.layout.force()
    .gravity(.05)
    .distance(200)
    .charge(-120)
    .size([width, height]);

    force
      .nodes(json.nodes)
      .links(json.links)
      .start();

  var link = svg.selectAll('.link')
    .data(json.links)
    .enter().append('line')
    .attr('class', 'link');

  var node = svg.selectAll('.node')
    .data(json.nodes)
    .enter().append('g')
    .attr('class', 'node')
    .call(force.drag);

  node.append('image')
    .attr('xlink:href', function(d) {
      if(d.image) {
        return d.image;
      }
    })
    .attr('x', -32)
    .attr('y', -32)
    .attr('width', 64)
    .attr('height', 64);

  node.append('text')
    .attr('dx', 12)
    .attr('dy', '.35em');

  node.on('mouseover', function(d) {
    link.text(function(d) {
      return d.name;
    });
  });

  force.on('tick', function() {
    link.attr('x1', function(d) { return d.source.x; })
      .attr('y1', function(d) { return d.source.y; })
      .attr('x2', function(d) { return d.target.x; })
      .attr('y2', function(d) { return d.target.y; });

    node.attr('transform', function(d) { return 'translate(' + d.x + ',' + d.y + ')'; });
  });
};

$(document).ready(function() {

  // Initialize Data
  var request_data = {
    apikey: '6e8b0eb33510fb5b13f1c744ccc4a5cb',
    limit: 100
  };

  var myMarvel = new MarvelAPI(request_data);

  // Growl defaults
  var growl_config = {
    placement: {
      from: 'bottom',
      align: 'right'
    },
    delay: 100000,
    allow_dismiss: false
  };

  var comparison_data = 'series';
  var comparison_message = _('Obtaining <%= type %> data ...').template();

  // Set up caches
  var $jumbotron = $('.jumbotron');
  var $form = $('form');
  var $button = $('#graph-it');
  var $char1_input = $('#character-input-1').val('');
  var $char2_input = $('#character-input-2').val('');

  // DOM and widget
  $button.on('click', function() {

    var char1 = $char1_input.val();
    var char2 = $char2_input.val();

    if(!char1 && !char2) {
      return;
    }

    // Throw a spinner up
    var l = Ladda.create(this);
    l.start();

    $jumbotron
      .removeClass('jumbotron').addClass('well')
      .find('h1, p').hide();
    $form.find('.row').removeClass('row');
    $button.find('.ladda-label').text('Reload!');

    var character1_data, character2_data;
    var character1, character2;

    // Give some user feedback
    var growl = $.growl({
      message: comparison_message({type: $('#select2-chosen-1').text()})
    }, $.extend({
      type: 'success'
    }, growl_config));

    // The next is a whee bit confusing
    // First, we need to get the character API to obtain the thumbnail
    myMarvel.getData(char1).then(function(response) {

      // Store the entire character object
      character1 = response.data.results[0];

      // Give some user feedback
      growl.close();
      growl = $.growl({
        message: comparison_message({type: $('#select2-chosen-1').text() + '\'s ' + comparison_data})
      }, $.extend({
        type: 'success'
      }, growl_config));

      // Return the promise
      return myMarvel.getAllData(character1.id + '/' + comparison_data);

    // Now, we need to get the entire series of that character
    }).then(function(response) {

      // Store the character data
      character1_data = myMarvel.parseCharacterData(character1, response);

      // Give some user feedback
      growl.close();
      growl = $.growl({
        message: comparison_message({type: $('#select2-chosen-2').text()})
      }, $.extend({
        type: 'success'
      }, growl_config));

      // Get the secondary character information
      return myMarvel.getData(char2);

    // Now, character #2, to obtain their thumbnail
    }).then(function(response) {

      // Store the entire character object
      character2 = response.data.results[0];

      // Give some user feedback
      growl.close();
      growl = $.growl({
        message: comparison_message({type: $('#select2-chosen-2').text() + '\'s ' + comparison_data})
      }, $.extend({
        type: 'success'
      }, growl_config));

      // Return the promise
      return myMarvel.getAllData(character2.id + '/' + comparison_data);

    // Now, character #2, to obtain their series
    }).then(function(response) {
      character2_data = myMarvel.parseCharacterData(character2, response);

      var char1_list = _.pluck(character1_data.nodes, 'name');
      var char2_list = _.pluck(character2_data.nodes, 'name');

      var node_list = [character1_data.nodes[0], character2_data.nodes[0]];
      var link_list = [];
      for (var ii = 0; ii < char1_list.length; ii++) {
        if (char2_list.indexOf(char1_list[ii]) === -1) {
          node_list.push(character1_data.nodes[ii]);
          link_list.push({ target: node_list.length - 1, source: 0 });
        } else {
          character1_data.nodes[ii].group = 1;
          node_list.push(character1_data.nodes[ii]);
          link_list.push({ target: node_list.length - 1, source: 0 });
          link_list.push({ target: node_list.length - 1, source: 1 });
        }
      }
      for (var ii = 0; ii < char2_list.length; ii++) {
        if (char1_list.indexOf(char2_list[ii]) === -1) {
          character2_data.nodes[ii].group = 2;
          node_list.push(character2_data.nodes[ii]);
          link_list.push({ target: node_list.length - 1, source: 1 });
        }
      }

      // Close the final growl if its still around
      growl.close();

      // Finally, lets graph it!
      graphIt('#graph-container', {
        nodes: node_list,
        links: link_list
      });

    }).fail(function(data) {
      $.growl({
        message: data.responseText
      }, $.extend({
        type: 'danger'
      }, growl_config));
    }).always(function() {
      // Hide the spinner
      l.stop();
    });
  }).prop('disable', false);

  // Set up the select boxes, which autocomplete from the API
  var select_options = {
    minimumInputLength: 1,
    ajax: {
      cache: true,
      url: myMarvel.getBaseURL(),
      dataType: 'json',
      data: function (term) {
        return $.extend({
          nameStartsWith: term
        }, myMarvel.request_data);
      },
      results: function (data) {
        for (var ii = 0; ii < data.data.results.length; ii++) {
          data.data.results[ii].text = data.data.results[ii].name;
        }
        return {
          results: data.data.results
        };
      }
    }
  };
  $char1_input.select2($.extend(true, select_options, {placeholder: 'Hawkeye'}));
  $char2_input.select2($.extend(true, select_options, {placeholder: 'Gambit'}));

  // Disable form submission, we'll take care of the ajax calls ourself
  $form.submit(function(e) {
    e.preventDefault();
  });
})
