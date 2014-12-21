Nodes = new Mongo.Collection("nodes");
Links = new Mongo.Collection("links");

if (Meteor.isClient) {

  Template.controlpanel.helpers({
    nodes: function() {
      return Nodes.find({});
    },
    links: function() {
      return Links.find({});
    }
  });

  Template.controlpanel.events({
    "submit #newnode": function(event) {
      event.preventDefault();
      Nodes.insert({
        title: event.target.title.value,
        type: event.target.nodetype.value
      });
    },
    "submit #newlink": function(event) {
      event.preventDefault();
      Links.insert({
        source: event.target.sourceid.value,
        target: event.target.targetid.value,
        type: event.target.linktype.value
      });
    },
    "submit #delnode": function(event) {
      event.preventDefault();
      Nodes.remove({
        _id: event.target.nodeitem.value
      });
    },
    "submit #dellink": function(event) {
      event.preventDefault();
      Links.remove({
        _id: event.target.linkitem.value
      });
    }
  });

  Template.graphvis.rendered = function() {

    var nodesCursor = Nodes.find({}),
      linksCursor = Links.find({});
    var nodes = nodesCursor.fetch(),
      links = linksToD3Array(linksCursor.fetch(), nodes);
    graphvis = new GraphVis("#graphvis", nodes, links);

    nodesCursor.observe({
      added: function(doc) {
        graphvis.addNode(doc);
        graphvis.render();
      },
      removed: function(doc) {
        graphvis.removeNode(doc);
        graphvis.render();
      }
    });
    linksCursor.observe({
      added: function(doc) {
        graphvis.addLink(doc);
        graphvis.render();
      },
      removed: function(doc) {
        graphvis.removeLink(doc);
        graphvis.render();
      }
    });

  };

}

function linksToD3Array(linksCol, nodesCol) {
  var nodes = {};
  nodesCol.forEach(function(node) {
    nodes[node._id] = node;
  });
  var result = [];
  linksCol.forEach(function(link) {
    var tmp = {
      source: nodes[link.source],
      target: nodes[link.target],
      type: link.type,
      _id: link._id
    };
    result.push(tmp);
  });
  return result;
}

function GraphVis(selector, nodes, links) {

  this.nodes = nodes;
  this.links = links;

  // init svg
  var svg = d3.select(selector);
  // clean up all previous items before render
  svg.selectAll("*").remove();
  // wrap graph into container to enable zoom and pan
  var container = svg.append('g');
  // zoom (and accompanying pan)
  var zoom = d3.behavior.zoom()
    .scaleExtent([0.8, 3])
    .on("zoom", function() {
      container.attr("transform",
        "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
    });
  svg.call(zoom);

  // init force layout
  var force = d3.layout.force()
    .nodes(this.nodes)
    .links(this.links)
    .linkDistance(100)
    .charge(-600)
    .on("tick", tick);

  // setup z-index for svg elements
  var lineG = container.append("g"),
    circleG = container.append("g");
  var line = lineG.selectAll("line"),
    circle = circleG.selectAll("circle"),
    // add arrow markers needed for directed link
    // they don't inherit styles, style them by type id
    arrow = lineG.append("defs").selectAll("marker")
    .data(["type1", "type2"])
    .enter().append("marker")
    .attr("id", function(d) {
      return d;
    })
    .attr("viewBox", "0 0 10 10")
    .attr("refX", "20")
    .attr("refY", "5")
    .attr("markerUnits", "strokeWidth")
    .attr("markerWidth", "9")
    .attr("markerHeight", "5")
    .attr("orient", "auto")
    .append("svg:path")
    .attr("d", "M 0 0 L 10 5 L 0 10 z");

  // auto-adjust to changed window size
  resize();
  d3.select(window).on("resize", resize);

  // tick
  function tick() {
    circle.attr('cx', function(d) {
        return d.x;
      })
      .attr('cy', function(d) {
        return d.y;
      });
    line.attr('x1', function(d) {
        return d.source.x;
      })
      .attr('y1', function(d) {
        return d.source.y;
      })
      .attr('x2', function(d) {
        return d.target.x;
      })
      .attr('y2', function(d) {
        return d.target.y;
      });
  }

  // resize svg and force layout when screen size change
  function resize() {
    var width = window.innerWidth,
      height = window.innerHeight;
    svg.attr("width", width).attr("height", height);
    force.size([width, height]).resume();
  }

  // dynamically update the graph
  this.render = function() {
    // add links
    line = line
      .data(force.links(), function(d) {
        return d._id;
      });
    line
      .enter().append("line")
      .attr("class", function(d) {
        return "line-" + d.type;
      })
      .attr("marker-end", function(d) {
        return "url(#" + d.type + ")";
      });
    line.exit().remove();

    // add nodes
    circle = circle
      .data(force.nodes(), function(d) {
        return d._id;
      });
    circle
      .enter().insert("circle")
      .attr("r", 8)
      .attr("class", function(d) {
        return "circle-" + d.type;
      });
    circle.exit().remove();

    force.start();
  };

  // graph data manipulation
  this.addNode = function(doc) {
    this.nodes.push(doc);
  };

  this.addLink = function(doc) {
    this.links.push(linksToD3Array([doc], this.nodes)[0]);
  };

  this.removeNode = function(doc) {
    var iToRemove;
    this.nodes.forEach(function(node, i) {
      if (node._id === doc._id) {
        iToRemove = i;
      }
    });
    this.nodes.splice(iToRemove, 1);
  };

  this.removeLink = function(doc) {
    var iToRemove;
    this.links.forEach(function(link, i) {
      if (link._id === doc._id) {
        iToRemove = i;
      }
    });
    this.links.splice(iToRemove, 1);
  };

}

if (Meteor.isServer) {
  Meteor.startup(function() {
    // code to run on server at startup
  });
}
