var redrugsApp = angular.module('redrugsApp', []);

redrugsApp.controller('ReDrugSCtrl', function ReDrugSCtrl($scope, $http) {
    
    // ELEMENTS
    $scope.elements = {
        nodes:[],
        edges:[]
    };
    $scope.nodeMap = {};
    $scope.edges = [];
    $scope.edgeMap = {};

    // SEARCH TERMS
    $scope.searchTerms = "";
    $scope.searchTermURIs = {};

    // JQUERY AUTOCOMPLETE UI WIDGET
    $(".searchBox").autocomplete({
        minLength : 3,
        select: function( event, ui ) {
            if (ui.item.label === "No Matches Found") { ui.item.label = ""; }
            $scope.searchTerms = ui.item.label;
            $('.searchBox').val(ui.item.label);
            $("#infobox").css("display","none");
            return false;
        },
        close: function( event, ui ) {
            $("#infobox").css("display","none");
        },
        focus: function( event, ui ) {
            if (ui.item.label === "No Matches Found") { ui.item.label = ""; }
            $('.searchBox').val(ui.item.label);

            // Add infobox
            $('#infobox').css({
                "display": "block",
                "border": "1px solid #BDBDBD"
            });
            if (document.getElementById("initial") === null) {
                $("#infobox").css({
                    "margin":"1em",
                    "width":"auto",
                    "max-width":"45%",
                });
                if ($(window).width() > 768) {
                    $("#infobox").css("left", "25%");
                } else {
                    $("#infobox").css("left", "50%");
                }
            }

            // Get preview information
            // var g = new $.Graph();
            // $scope.createResource($scope.searchTermURIs[$.trim(ui.item.label)],g);
            // $scope.services.preview(g, function(result){
            //     var elements = $scope.getElements(result);
            //     var diseases=elements.filter(function(e){
            //         return e.data.types["http://semanticscience.org/resource/SIO_010056"];
            //     });
            //     var proteins=elements.filter(function(e){
            //         return e.data.types["http://semanticscience.org/resource/protein"];
            //     });
            //     var l = ui.item.label.indexOf(' - ');
            //     var label = ui.item.label.substring(0,l);
            //     $("#infobox").html(
            //         "<span>Closest connections to <strong>" + label + "</strong>:</span> <ul>" +
            //         "<li>Found <strong>" + result.resources.length + "</strong> nodes</li>" +
            //         "<li>Number of diseases: <strong>" + diseases.length + "</strong></li>" +
            //         "<li>Number of proteins: <strong>" + proteins.length + "</strong></li></ul>"
            //     );
            // });
            return false;
        },
        source: function(query, process) {
            var g = new $.Graph();
            var res = g.getResource($scope.ns.local("query"));
            res[$scope.ns.prov('value')] = [query.term];
            res[$scope.ns.rdf('type')] = [g.getResource($scope.ns.pml('Query'))];
            $scope.services.search(g,function(graph) {
                var keywords = graph.resources.map(function(d) {
                    return graph.getResource(d);
                    }).filter(function(d) {
                        return d[$scope.ns.pml('answers')];
                    }).map(function(d) {
                        var result = d[$scope.ns.rdfs('label')][0];
                        var j = d.uri.indexOf('/', 18) + 1;
                        var dbid = d.uri.substring(j);
                        result += " - " + dbid;
                        var count  = d[$scope.ns.sio('count')][0];
                        result += " ("+count+" connections)";
                        $scope.searchTermURIs[result] = d.uri;
                        return result;
                    });
                //keywords.sort(function(a, b) {
                //    return parseInt(a[$scope.ns.sio('count')][0]) - parseInt(b[$scope.ns.sio('count')][0]);
                //})
                //keywords.reverse();
                if (keywords.length === 0) {
                    keywords = ["No Matches Found"];
                    $(".searchbtn").attr("disabled", "disabled");
                }
                else { $(".searchbtn").removeAttr("disabled"); }
                process(keywords);
            }, $scope.graph, $scope.handleError);
        }
    });


    /* 
     * CYTOSCAPE IMPLEMENTATION
     */
    $scope.results = $('#results');
    $scope.neighborhood = [];
    $scope.layout = {
        name: 'arbor',
        fit: false,
        padding: [20,20,20,20],
        circle: true,
        concentric: function(){ 
            //var rank = $scope.pageRank.rank(this);
            //console.log(this, rank, this.degree());
            //return $scope.pageRank.ordinal[rank];
            //this.indegree() + this.outdegree();
            return this.degree() * 10;
        },
        maxSimulationTime: parseInt($scope.numLayout) * 1000
    };
    $scope.createGraph = function() {
        $scope.results.cytoscape({
            style: cytoscape.stylesheet()
                .selector('node')
                .css({
                    'min-zoomed-font-size': 8,
                    'content': 'data(label)',
                    'text-valign': 'center',
                    'color':'white',
                    'background-color': 'data(color)',
                    'shape': 'data(shape)',
                    'border-color': 'data(linecolor)',
                    'border-width': 2,
                    'text-outline-width': 2,
                    'text-outline-color': '#333333',
                    'height': 'data(size)',
                    'width': 'data(size)',
                    'cursor': 'pointer'
                })
                .selector('edge')
                .css({
                    'opacity':'data(probability)',
                    'width':'data(width)',
                    'target-arrow-shape': 'data(shape)',
                    'target-arrow-color': 'data(color)',
                    'line-color': 'data(color)'
                })
                .selector(':selected')
                .css({
                    'background-color': '#D8D8D8',
                    'border-color': '#D8D8D8',
                    'line-color': '#D8D8D8',
                    'target-arrow-color': '#D8D8D8',
                    'source-arrow-color': '#D8D8D8',
                    'opacity':1,
                })
                .selector('.highlighted')
                .css({
                    'background-color': '#000000',
                    'line-color': '#000000',
                    'target-arrow-color': '#000000',
                    'transition-property': 'background-color, line-color, target-arrow-color, height, width',
                    'transition-duration': '0.5s'
                })
                .selector(':locked')
                .css({
                    'background-color': '#7f8c8d'
                })
                .selector('.faded')
                .css({
                    'opacity': 0.25,
                    'text-opacity': 0
                }),

            elements: [] ,

            hideLabelsOnViewport: true ,

            ready: function(){
                $scope.cy = cy = this;
                cy.boxSelectionEnabled(true);

                // Clicking on whitespace removes all CSS changes
                cy.on('vclick', function(e){
                    if( e.cyTarget === cy ){
                        cy.elements().removeClass('faded');
                        cy.elements().removeClass("highlighted");
                        $scope.bfsrun = false;
                        $("#edgeask").removeClass('hidden');
                        $('#edgeoverview').html("");
                        $('#edgetable').html("");
                        $("#nodeask").removeClass('hidden');
                        $("#nodeopts").addClass('hidden');
                        $('#nodeoverview').html("");
                        $('#nodetable').html("");
                        $scope.neighborhood = [];
                    }
                });

                // When an edge is selected
                cy.on('select', 'edge', function(e) {
                    var uris = [];
                    var db = function() {
                        var result = "";
                        for (var k in uris) { result += "<li>" + k + "</li>"; }
                        return result;
                    };
                    // Creates the table of provenance information
                    var infolist = function(source) {
                        var table = []
                        for (i = 0; i < source.length; i++) {
                            // Gets name of database source
                            var start = source[i].indexOf("dataset/") + 8;
                            var end = source[i].indexOf("/", start);
                            var db = source[i].slice(start, end);
                            var db2 = db.charAt(0).toUpperCase() + db.slice(1);
                            uris[db2] = true;
                            // Gets name of the interactionType
                            start = source[i].indexOf("URIRef(u'", end) + 9;
                            end = source[i].indexOf("'),", start);
                            var typeLabel = source[i].slice(start, end);
                            typeLabel = (!$scope.edgeTypes[typeLabel]) ? 'Interaction with Disease' : $scope.edgeTypes[typeLabel]
                            // Gets probability value
                            start = source[i].indexOf("Literal(u'") + 10;
                            end = source[i].indexOf("'", start);
                            var prob = source[i].slice(start, end);
                            // Add data to table array
                            var temp = [];
                            temp.push(db2);
                            temp.push(typeLabel);
                            temp.push(prob);
                            table.push(temp);
                        }
                        var t = "";
                        for (i = 0; i < table.length; i++) {
                            t = t + "<tr>";
                            for (j = 0; j < 3; j++) {
                                t = t + "<td>" + table[i][j] + "</td>";
                            }
                            t = t + "</tr>";
                        }
                        return t;
                    }
                    var edge = e.cyTarget;
                    var table = infolist(edge.data().data);
                    var info = "<p><strong>Interaction:</strong> " + edge.data().types + "</p>";

                    // if (edge.data().desc != null) { info = info + "<p><strong>Description:</strong> " + edge.data().desc + "</p>"; }
                    
                    info = info + "<p><strong>Probability:</strong> " + edge.data().probability + "</p>";
                    info = info + "<p><strong>Z-Score:</strong> " + edge.data().zscore + "</p>";
                    info = info + "<ul id='dbref'><strong>Databases Referenced:</strong> " + db() + "</ul>";
                    $("#edgeoverview").html(info);
                    $("#edgetable").html('<table class="table"><thead><tr><th>Database</th><th>Interaction Type</th><th>Probability</th></tr></thead><tbody>' + table + '</tbody></table>');
                    $('#tabs a[href="#edgeinfo"]').tab('show'); 
                    $("#edgeask").addClass('hidden');
                    $("#nodeask").removeClass('hidden');
                    $("#nodeopts").addClass('hidden');
                    $('#nodeoverview').html("");
                    $('#nodetable').html("");
                });

                // When a node is selected
                cy.on('select', 'node', function(e){
                    var node = e.cyTarget; 
                    $scope.bfsrun = false;
                    $('#tabs a[href="#explore"]').tab('show'); 
                    $("#nodeask").addClass('hidden');
                    var info = "<h3>Node: " + node.data().label + "</h3>"; 
                    $("#nodeoverview").html(info);

                    /*
                    info = "<li>Organism: " + node.data().organism + "</li>";
                    info = info + "<li>Gene name: " + node.data().genename + "</li>";
                    if (node.data().db != null ) { info = info + "<li>Source: " + node.data().db + "</li>"; }
                    if (node.data().desc != null) { info = info + "<li>Description: " + node.data().desc + "</li>"; }
                    if (node.data().dburl != null) { info = info + "<li><a href='" + node.data().dburl + "'>Database URL</a></li>"; }
                    $("#nodetable").html(info);
                    */

                    $("#nodeopts").removeClass('hidden');
                    $("#edgeask").removeClass('hidden');
                    $('#edgeoverview').html("");
                    $('#edgetable').html("");

                    // Fade outside of neighborhood of all selected elements
                    var neighborhood = node.neighborhood().add(node);
                    $scope.neighborhood.push(neighborhood);
                    if ($scope.neighborhood.length > 0) {
                        cy.elements().addClass('faded');
                        for (var n in $scope.neighborhood) {
                            $scope.neighborhood[n].removeClass('faded');
                        }
                    }
                    // socket.send((pos.x).toFixed(2));
                    // socket.send((pos.y).toFixed(2));
                });
            }
        });
    }
    $scope.createGraph();


    /* 
     * SADI SERVICES
     * Run asynchronously
     */
    $scope.graph = $.Graph();
    $scope.ns = {
        rdf: $.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#"),
        rdfs: $.Namespace("http://www.w3.org/2000/01/rdf-schema#"),
        prov: $.Namespace("http://www.w3.org/ns/prov#"),
        pml: $.Namespace("http://provenanceweb.org/ns/pml#"),
        sio: $.Namespace("http://semanticscience.org/resource/"),
        dcterms: $.Namespace("http://purl.org/dc/terms/"),
        local: $.Namespace("urn:redrugs:")
    };
    $scope.services = {
        search: $.SadiService("/api/search"),
        process: $.SadiService("/api/process"),
        upstream: $.SadiService("/api/upstream"),
        downstream: $.SadiService("/api/downstream"),
        preview: $.SadiService("/api/preview")
    };


    /* 
     * URI MAPPINGS 
     */
    // Maps each type of edge interaction with its name.
    $scope.edgeNames = {
        "http://purl.obolibrary.org/obo/CHEBI_48705": "Agonist",                   
        "http://purl.obolibrary.org/obo/MI_0190": "Molecule Connection",  
        "http://purl.obolibrary.org/obo/CHEBI_23357": "Cofactor",                  
        "http://purl.obolibrary.org/obo/CHEBI_25212": "Metabolite",                
        "http://purl.obolibrary.org/obo/CHEBI_35224": "Effector",                   
        "http://purl.obolibrary.org/obo/CHEBI_48706": "Antagonist",                
        "http://purl.org/obo/owl/GO#GO_0048018": "Receptor Agonist Activity",                     
        "http://www.berkeleybop.org/ontologies/owl/GO#GO_0030547":"Receptor Inhibitor Activity",    
        "http://purl.obolibrary.org/obo/MI_0915": "Physical Association",          
        "http://purl.obolibrary.org/obo/MI_0407": "Direct Interaction",          
        "http://purl.obolibrary.org/obo/MI_0191": "Aggregation",                   
        "http://purl.obolibrary.org/obo/MI_0914": "Association",                    
        "http://purl.obolibrary.org/obo/MI_0217": "Phosphorylation Reaction",     
        "http://purl.obolibrary.org/obo/MI_0403": "Colocalization",               
        "http://purl.obolibrary.org/obo/MI_0570": "Protein Cleavage",              
        "http://purl.obolibrary.org/obo/MI_0194": "Cleavage Reaction"             
    }
    // Maps edge interaction types to values for Cytoscape visualization
    $scope.edgeTypes = {
        "tri" : {
            "shape": "triangle",
            "color": "#FED700",
            "uris": [
                "http://purl.obolibrary.org/obo/CHEBI_48705", 
                "http://purl.obolibrary.org/obo/CHEBI_23357",
                "http://purl.obolibrary.org/obo/CHEBI_25212",
                "http://purl.org/obo/owl/GO#GO_0048018"
            ],
            "filter": false
        },
        "tee" : {
            "shape": "tee",
            "color": "#BF1578",
            "uris": [
                "http://purl.obolibrary.org/obo/CHEBI_48706",
                "http://www.berkeleybop.org/ontologies/owl/GO#GO_0030547",
            ],
            "filter": false
        },
        "cir" : {
            "shape": "circle",
            "color": "#6FCCDD",
            "uris": [
                "http://purl.obolibrary.org/obo/MI_0915",
                "http://purl.obolibrary.org/obo/MI_0191",
                "http://purl.obolibrary.org/obo/MI_0403"
            ],
            "filter": false
        },
        "dia" : {
            "shape": "diamond",
            "color": "#7851A1",
            "uris": [
                "http://purl.obolibrary.org/obo/MI_0217"
            ],
            "filter": false
        },
        "squ" : {
            "shape": "square",
            "color": "#A0A0A0",
            "uris": [
                "http://purl.obolibrary.org/obo/MI_0570",
                "http://purl.obolibrary.org/obo/MI_0194"
            ],
            "filter": false
        },
        "non" : {
            "shape": "triangle",
            "color": "#A7CE38",
            "uris": [
                "http://purl.obolibrary.org/obo/MI_0190",
                "http://purl.obolibrary.org/obo/CHEBI_35224",
                "http://purl.obolibrary.org/obo/MI_0407",
                "http://purl.obolibrary.org/obo/MI_0914"
            ],
            "filter": false
        },
        "other": {
            "shape": "triangle",
            "color": "#FF0040",
            "uris": [],
            "filter": false
        }
    }
    // Maps node types to values for Cytoscape visualization
    $scope.nodeTypes = {
        // "triangle" : {
        //     "shape": "triangle",
        //     "size": "70",
        //     "color": "#FED700",
        //     "uris": ["http://semanticscience.org/resource/activator"]
        // },
        // "star" : {
        //     "shape": "star",
        //     "size": "70",
        //     "color": "#BF1578",
        //     "uris": ["http://semanticscience.org/resource/inhibitor"]
        // },
        "square" : {
            "shape": "square",
            "size": "50",
            "color": "#EA6D00",
            "uris": ["http://semanticscience.org/resource/protein"]
        },
        "rect" : {
            "shape": "roundrectangle",
            "size": "60",
            "color": "#112B49",
            "uris": ["http://semanticscience.org/resource/SIO_010056"]
        },
        "circle" : {
            "shape": "circle",
            "size": "60",
            "color": "#16A085",
            "uris": ["http://semanticscience.org/resource/activator", "http://semanticscience.org/resource/inhibitor", "http://semanticscience.org/resource/drug"]
        },
        "other" : {
            "shape": "circle",
            "size": "50",
            "color": "#FF7F50",
            "uris": []
        }
    }
    // Gets the node feature of a given uri.
    $scope.getNodeFeature = function(feature, uris) {
        var keys = Object.keys($scope.nodeTypes);
        for (var i = 0; i < keys.length; i++) {
            for (var j = 0; j < uris.length; j++) {
                if ($scope.nodeTypes[keys[i]]["uris"].indexOf(uris[j]) > -1) {
                    return $scope.nodeTypes[keys[i]][feature];
                }
            }
        }
        return $scope.nodeTypes["other"][feature];
    }
    // Gets the edge feature of a given uri.
    $scope.getEdgeFeature = function(feature, uri) {
        if (feature == "name") { return $scope.edgeNames[uri]; }
        else {
            var keys = Object.keys($scope.edgeTypes);
            for (var i = 0; i < keys.length; i++) {
                if ($scope.edgeTypes[keys[i]]["uris"].indexOf(uri) > -1) {
                    return $scope.edgeTypes[keys[i]][feature];
                }
            }
            return $scope.edgeTypes["other"][feature];
        }
    }


    /* 
     * OPTIONS
     */
    $scope.showLabel = true;
    $scope.bfsrun = false;
    $scope.numSearch = 1;
    $scope.numLayout = 20;
    $scope.probThreshold = 0.95;
    $scope.found = -1;
    $scope.once = false;
    $scope.query = "none";     
    $scope.filter = {
        "customNode": {
            "activator": true,
            "inhibitor": true,
            "protein": true,
            "disease": true,
            "drug": true,
            "undef": true
        },
        "customEdge": {
            "activation": true,
            "inhibition": true,
            "association": true,
            "reaction": true,
            "cleavage": true,
            "interaction": true
        }
    }


    /*
     * HELPER FUNCTIONS
     */

    // Error Handling
    $scope.handleError = function(data,status, headers, config) {
        $scope.error = true;
        $scope.loading = false;
    };
    // Returns a list of the requested attribute of the selected nodes.
    $scope.getSelected = function(attr) {
        if (!$scope.cy) return [];
        var selected = $scope.cy.$('node:selected');
        var query = [];
        selected.nodes().each(function(i,d) { query.push(d.data(attr)); });
        return query;
    };
    // Appears to help create resources to add to the graph.
    $scope.createResource = function(uri, graph) {
        var entity = graph.getResource(uri,'uri');
        entity[$scope.ns.rdf('type')] = [
            graph.getResource($scope.ns.sio('process'),'uri'),
            graph.getResource($scope.ns.sio('material-entity'),'uri')
        ];
        return entity;
    };
    // Used to replace non-working id URI with working URI
    $scope.newURI = function(oldURI) {
        var parser = document.createElement('a');
        parser.href = oldURI;
        var source = (parser.pathname).substring(1, parser.pathname.indexOf(':'));
        if (source === "uniprot") {
            return "http://www.uniprot.org/uniprot/" + (parser.pathname).substring(parser.pathname.indexOf(':') + 1);
        } else if (source === "refseq") { return oldURI; }
        return "http://" + source + ".bio2rdf.org/describe/?url=" + encodeURIComponent(oldURI);
    };


    /*
     * NODE FUNCTIONS
     */

    // Gets the details of a node by opening the uri in a new window.
    $scope.getDetails = function(query) {
        var g = new $.Graph();
        query.forEach(function(uri) { window.open(uri); });
    };
    // Shows BFS animation starting from selected nodes
    $scope.showBFS = function(query) {
        $scope.bfsrun = true;
        query.forEach(function(id) {
            cy.elements().removeClass("highlighted");
            var root = "#" + id;
            var bfs = cy.elements().bfs(root, function(){}, true);
            var i = 0;
            var highlightNextEle = function(){
              bfs.path[i].addClass('highlighted');
              bfs.path[i].removeClass('faded');
              if( i < bfs.path.length - 1){
                i++;
                if ($scope.bfsrun) {
                    setTimeout(highlightNextEle, 50);
                } else { i = bfs.path.length; }
              }
            };
            highlightNextEle();
        });
    };
    // Lock/unlock the selected elements
    $scope.lock = function(query, lock) {
        query.forEach(function(id) {
            var node = "#" + id;
            if (lock) { cy.$(node).lock(); }
            else { cy.$(node).unlock(); }
        });
    }
    // Gets incoming connections of the selected nodes
    $scope.getUpstream = function(query) {
        $scope.loading = true;
        var g = new $.Graph();
        query.forEach(function(d) {
            $scope.createResource(d,g);
        });
        $scope.services.upstream(g,$scope.appendToGraph,$scope.graph,$scope.handleError);
    };
    // Gets outgoing connections of the selected nodes
    $scope.getDownstream = function(query) {
        $scope.loading = true;
        var g = new $.Graph();
        query.forEach(function(d) {
            $scope.createResource(d,g);
        });
        $scope.services.downstream(g,$scope.appendToGraph,$scope.graph,$scope.handleError);
    };

    
   
    /* 
     * CORE SEARCH FUNCTIONS
     */
    // Used to get node from nodeMap or to create a new node.
    $scope.getNode = function(res) {
        var node = $scope.nodeMap[res.uri];
        if (!node) {
            var newURI = $scope.newURI(res.uri);
            // Creates a new node and adds it to the nodeMap
            node = $scope.nodeMap[res.uri] = {
                group: "nodes",
                data: {
                    uri: res.uri,
                    details: newURI,
                    types: {},
                    resource: res
                },
                //position: { x: 0, y: 0}
            };
            // Remove all non-alphanumerical and replace space and underscore with hypen
            node.data.id = res[$scope.ns.rdfs('label')][0].replace(/[^a-z0-9\s]/gi, '').replace(/[_\s]/g, '-');
            node.data.label = res[$scope.ns.rdfs('label')];
            if (res[$scope.ns.rdf('type')]) res[$scope.ns.rdf('type')].forEach(function(d) {
                node.data.types[d.uri] = true;
            });
            var type = Object.keys(node.data.types);
            node.data.shape = $scope.getNodeFeature("shape", type);
            node.data.size = $scope.getNodeFeature("size", type);
            node.data.color = $scope.getNodeFeature("color", type);
            node.data.linecolor = "#E1EA38";
        }
        return node;
    };
    // Parses all edge and node information returned by upstream or downstream query
    $scope.getElements = function(result) {
        var elements = [];
        // For every resulting resource, apply getResource()
        result.resources.map(function(d) {
            return result.getResource(d);
        })
            // For this list of resources, filter for edges who has a target
            .filter(function(d) {
                return d[$scope.ns.sio('has-target')];
            })

            // For those filtered entities, apply the following
            .forEach(function(d) {
                var s = d[$scope.ns.sio('has-participant')][0];
                var t = d[$scope.ns.sio('has-target')][0];
                var source = $scope.getNode(s);
                var target = $scope.getNode(t);
                elements.push(source);
                elements.push(target);
                var edgeTypes = d[$scope.ns.rdf('type')];
                // Create the edge between source and target
                var edge = {
                    group: "edges",
                    data: $().extend({}, d, {
                        id: d[$scope.ns.prov('wasDerivedFrom')][0].uri,
                        source: source.data.id,
                        target: target.data.id, 
                        shape: $scope.getEdgeFeature("shape", edgeTypes[0].uri), 
                        types: (edgeTypes && !$scope.edgeNames[edgeTypes[0].uri]) ? 'Interaction with Disease' : $scope.edgeNames[edgeTypes[0].uri],
                        color: $scope.getEdgeFeature("color", edgeTypes[0].uri),
                        probability: d[$scope.ns.sio('probability-value')][0],
                        zscore: d[$scope.ns.sio('likelihood')][0],  // z-score-value
                        width: (d[$scope.ns.sio('likelihood')][0] * 4) + 1,
                        data: d[$scope.ns.prov('data')],
                        prov: d[$scope.ns.prov('wasDerivedFrom')],
                        resource: d
                    })
                };
                elements.push(edge);
            });
        return elements;
    };
    // Starts the search for given elements and its nearest downstream neighbors
    $scope.search = function(query) {
        $('#initial').remove();
        $('#interface, #explore, #minimize').css("visibility", "visible");
        $scope.loading = true;
        var g = new $.Graph();
        $scope.createResource($scope.searchTermURIs[$.trim(query)],g);
        $scope.query = query;
        // When the query is complete, sends the results to appendToGraph to asynchronously add new elements
        $scope.services.process(g,function(graph){
            $scope.services.downstream(g,$scope.appendToGraph,$scope.graph,$scope.handleError);
        },$scope.graph,$scope.handleError);
        $scope.once = false;
        $scope.found = -1;
    };
    // Adds elements to graph.
    $scope.appendToGraph = function(result) {
        var elements = $scope.getElements(result);
        $scope.found = elements.length;
        // If this is the first iteration and no results were found, find upstream entities
        if ($scope.found === 0 && !$scope.once) {
            var g = new $.Graph(); 
            $scope.createResource($scope.searchTermURIs[$.trim($scope.query)],g);
            $scope.services.process(g,function(graph){
                $scope.services.upstream(g,$scope.appendToGraph,$scope.graph,$scope.handleError);
            },$scope.graph,$scope.handleError);
            $scope.once = true;
        }
        var eles = $scope.cy.add(elements);
        //$scope.pageRank = $scope.cy.elements().pageRank();
        //$scope.pageRank.ordinal = {};
        //var ranks = [];
        //var ranked = {};
        //$scope.cy.nodes().each(function(i, node) {
        //    var rank = $scope.pageRank.rank(node);
        //    if (!ranked[rank]) {
        //        ranks.push(rank);
        //        ranked[rank] = true;
        //    }
        //});
        //ranks.sort().forEach(function(d,i) {
        //    $scope.pageRank.ordinal[d] = i * 4;
        //})
        setTimeout(function(){
            $scope.cy.layout($scope.layout);
            $scope.$apply(function(){ $scope.loading = false; });
        }, 1000);
        $scope.loaded = result.resources.length;
        $scope.cy.resize();
    };
    // For custom query
    $scope.currStep = 0;
    $scope.prevEle = [];
    $scope.traces = {};
    $scope.completedTraces = []
    $scope.jobQueue = {
        upstream: [],
        downstream: [],
    };
    $scope.queued = {
        upstream: {},
        downstream: {},
    };
    $scope.getCustomResults = function(result, direction) {
        // console.log(result);

        var links = result.resources
            .map(function(d) {
                return result.getResource(d);
            })
            .filter(function(d) {
                return d[$scope.ns.sio('has-target')];
            });

        // Source, target, edge
        var elements = {}
        $scope.getElements(result).forEach(function(d) {
            elements[d.data.uri] = d;
        });

        var addToGraph = [];
        var expand = [];

        var typeMapping = {
            "http://semanticscience.org/resource/activator":"activator",
            "http://semanticscience.org/resource/inhibitor":"inhibitor",
            "http://semanticscience.org/resource/protein": "protein",
            "http://semanticscience.org/resource/SIO_010056":"disease",
            "http://semanticscience.org/resource/drug": "drug",
            "Agonist":"activation",
            "Metabolite":"activation",
            "Receptor Agnoist Activity":"activation", 
            "Antagonist":"inhibition",
            "Receptor Inhibitor Activity":"inhibition",
            "Physical Association":"association",
            "Aggregation":"association",
            "Colocalization":"association", 
            "Phosphorylation Reaction":"reaction", 
            "Protein Cleavage":"cleavage",
            "Cleavage Reaction":"cleavage", 
            "Molecule Connection":"interaction",
            "Effector":"interaction",
            "Direct Interaction":"interaction",
            "Association":"interaction",
            "Interaction with Disease":"interaction"
        }
        var checkConnection = function(x, edge) {
            var keepNode = false;
            Object.keys(x).forEach(function(type) {
                if ($scope.filter.customNode[typeMapping[type]])
                    keepNode = true;
            });
            keepNode = keepNode || $scope.filter.customNode.undef;
            keepNode = keepNode && $scope.filter.customEdge[typeMapping[edge]];
            return keepNode;
        };

        // Split elements in graph to relevant or non-relevant. 
        links.forEach(function(link) {
            var near = direction == 'downstream' ? 
                link[$scope.ns.sio('has-participant')][0] :
                link[$scope.ns.sio('has-target')][0];

            var far = direction == 'downstream' ? 
                link[$scope.ns.sio('has-target')][0] :
                link[$scope.ns.sio('has-participant')][0];

            if (near == far) return;

            elements[far.uri].data.stepCount = elements[near.uri].data.stepCount + 1;
            var prob = elements[near.uri].data.prob * elements[link.uri].data.probability;
            if (prob >= $scope.probThreshold) {
                // Make sure we aren't overwriting a better path.
                if ($scope.traces[far.uri]) {
                    var oldTrace = $scope.traces[far.uri];
                    if (oldTrace[oldTrace.length-1].data.prob > prob)
                        return;
                }
                elements[far.uri].data.prob = prob;
                var trace = [elements[near.uri]];
                if ($scope.traces[near.uri] != null) {
                    trace = $scope.traces[near.uri].slice();
                } 
                trace.push(elements[link.uri]);
                trace.push(elements[far.uri]);
                $scope.traces[far.uri] = trace;
                var satisfies = checkConnection(elements[far.uri].data.types, elements[link.uri].data.types);
                if (satisfies) { addToGraph.push(far); }
                if (elements[far.uri].data.stepCount < $scope.numSearch && !$scope.queued[direction][far.uri]) {
                    $scope.queued[direction][far.uri] = true;
                    expand.push(far);
                }
            }
        });

        var resultElements = [];
        // For all destinations found, create chain to original selected node source
        addToGraph.forEach( function(element) {
            // console.log("adding trace",$scope.traces[element.data.uri]);
            resultElements = resultElements.concat($scope.traces[element.uri]);
            $scope.completedTraces.push($scope.traces[element.uri].slice());
        });

        var eles = $scope.cy.add(resultElements);

        var service = $scope.services[direction];
        // Need to do another search on all other nodes and then look for matches 
        var toExpand = expand.slice();
        var queue = $scope.jobQueue[direction];
        queue.push.apply(queue, expand);
        function submitService() {
            if (queue.length > 0) {
                var g = new $.Graph();
                queue.splice(0,10).forEach(function(d) {
                    $scope.createResource(d.uri,g);
                });
                service(g, function(result) {
                    $scope.getCustomResults(result, direction);
                }, new $.Graph(), function(data,status, headers, config){
                    $scope.handleError(data,status, headers, config)
                    submitService();
                });
            }
        }
        submitService();
        if (!$scope.showLabel) { $scope.cy.elements().addClass("hideLabel"); }
        $scope.cy.layout($scope.layout);
        $scope.loaded += resultElements.filter(function(d){ return d.group == 'edges'}).length;
        if ($scope.jobQueue.upstream.length == 0 && $scope.jobQueue.downstream.length == 0) {
            $scope.$apply(function(){ $scope.loading = false; });
        }
    }


    /*
     *  GUI INTERACTIONS
     */
    // Help hover 
    $("#help").hover(
        function() { $('#help-info').show();}, 
        function() { $('#help-info').hide();}
    );
    // Create tab functionality
    $('#guitabs a').click(function (e) {
      e.preventDefault()
      $(this).tab('show')
    })
    // Starts new Cytoscape visualization instead of adding to existing
    $(".search-btn").click(function() {
        $scope.cy.load();
        $scope.search($scope.searchTerms);
    });
    // Minimize sidebar
    $('#minimize').click(function() {
        if ($('#minimize').html() === '<i class="fa fa-caret-down"></i> <span>Show sidebar</span>') {
            $("#results").removeClass("col-md-12");
            $("#results").addClass("col-md-9");
            $("#interface").css("display", "block"); 
            $("#minimize").html('<i class="fa fa-caret-up"></i> <span>Hide sidebar</span>');        
            $("#minimize").removeClass("maximize");
            $scope.cy.resize();
        }
        else {
            $("#interface").css("display", "none"); 
            $("#minimize").html('<i class="fa fa-caret-down"></i> <span>Show sidebar</span>');
            $("#minimize").addClass("maximize");
            $("#results").removeClass("col-md-9");
            $("#results").addClass("col-md-12");
            $scope.cy.resize();
        }
    });
    // Refresh
    $("#refresh").click(function() {
        $scope.cy.resize();
        $scope.cy.layout($scope.layout);
    });
    // Zoom
    $("#zoom-fit").click(function() { $scope.cy.fit(50); });
    $("#zoom-in").click(function() {
        var midx = $(window).width() / 2;
        var midy = $(window).height() / 2;
        $scope.cy.zoom({
            level: $scope.cy.zoom() + 0.25,
            renderedPosition: { x: midx, y: midy }
        });
    });
    $("#zoom-out").click(function() {
        if ($scope.cy.zoom() >= 0.25) {
            var midx = $(window).width() / 2;
            var midy = $(window).height() / 2;
            $scope.cy.zoom({
                level: $scope.cy.zoom() - 0.25,
                renderedPosition: { x: midx, y: midy }
            });
        }
    });
    // Background
    $("#bgdark").click(function() {
        $('body').css("background", 'url("../img/simple_dashed_@2X.png")');
    });
    $("#bglight").click(function() {
        $('body').css("background", 'url("../img/agsquare_@2X.png")');
    });
    $scope.downloadPNG = function() {
        var a = document.createElement('a');
        a.download = "redrugs.png";
        var raw = atob($scope.cy.png({full:true, scale:4}).replace('data:image/png;base64,',''));

        var rawLength = raw.length;

        var uInt8Array = new Uint8Array(rawLength);

        for (var i = 0; i < rawLength; ++i) {
            uInt8Array[i] = raw.charCodeAt(i);
        }
        var blob = new Blob([uInt8Array], {type: "image/png"});
        var url = window.URL.createObjectURL(blob);
        a.href = url;
        a.download = "redrugs.png";
        a.click();
        window.URL.revokeObjectURL(url);
    };
    $scope.downloadJSON = function() {
        var a = document.createElement('a');
        a.download = "redrugs.json";

        var blob = new Blob([JSON.stringify($scope.cy.json())], {type: "application/json"});
        var url = window.URL.createObjectURL(blob);
        a.href = url;
        a.click();
        window.URL.revokeObjectURL(url);
    };
    $scope.downloadConnectivity = function() {
        var a = document.createElement('a');
        a.download = "redrugsConnectivity.csv";

        var data = 'start,start label,end,end label,steps,joint p,search\n';
        data += $scope.completedTraces.map(function(trace) {
            var first = trace[0];
            var last = trace[trace.length-1];
            return [
                first.data.uri,
                '"' + first.data.label[0] + '"',
                last.data.uri,
                '"' + last.data.label[0] + '"',
                (trace.length-1)/2,
                trace.filter(function(d){ return d.group == 'edges'; })
                    .map(function(d) { return d.data.probability; })
                    .reduce(function(a,b){ return a * b;}),
                '"https://scholar.google.com/scholar?q='+
                    [first.data.label[0].replace(' ','+'),
                     last.data.label[0].replace(' ','+')].join('+') + '"'
            ].join(",");
        }).join("\n");

        var blob = new Blob([data], {type: "application/json"});
        var url = window.URL.createObjectURL(blob);
        a.href = url;
        a.click();
        window.URL.revokeObjectURL(url);
    };
    // Find custom expansions
    $scope.runQuery = function(type, directions) {
        $scope.loaded = 0;
        $scope.numSearch = parseInt($scope.numSearch);
        $scope.probThreshold = parseFloat($scope.probThreshold);
        if ($scope.numSearch < 0 || $scope.probThreshold < 0) { return; }
        $scope.traces = {};
        $scope.completedTraces = [];
        $scope.jobQueue = {
            upstream: [],
            downstream: []
        };
        $scope.queued = {
            upstream: {},
            downstream: {}
        };
        $scope.cy.$('node:selected').nodes().each(function(i,d) {
            $scope.selectedEle = d.data('id');
            d.data().prob = 1;
            d.data().stepCount = 0;
        });
        $scope.prevEle = new Array($scope.numSearch + 1);
        $scope.loading = true;
        var g = new $.Graph();
        $scope.getSelected('uri').forEach(function(d) { $scope.createResource(d,g); });
        if (type !== "custom") {
            for (var e in $scope.filter["customEdge"]) {
                $scope.filter["customEdge"][e] = true;
            }
            for (var e in $scope.filter["customNode"]) {
                if (type === "all") {
                    $scope.filter["customNode"][e] = true;
                } else {
                    if (e !== type) {
                        $scope.filter["customNode"][e] = false;
                    } else {
                        $scope.filter["customNode"][e] = true;
                    } 
                }
            }
        }
        directions.forEach(function(direction) {
            $scope.services[direction](g, function(result) {
                $scope.getCustomResults(result, direction);
            }, $scope.graph, $scope.handleError);
        });
    }

    /* Refining screen layout */
    $(window).resize(function(){
        var w = $(window).width();
        // If the window is larger than 1920px 
        if (w > 1920 && !$("#interface-wrapper").hasClass("fixed")) {  
            $("#interface-wrapper").addClass("fixed");
            $(".rest").css("width", w-400 + "px !important");
            $("#results").addClass("rest");
        }   
        else if(w <= 1920 && $("#interface-wrapper").hasClass("fixed")) {
            $("#interface-wrapper").removeClass("fixed");
            $("#results").removeClass("rest");
        }
    });
})
