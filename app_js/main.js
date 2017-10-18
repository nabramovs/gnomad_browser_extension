function main() {
    update_page_html()
    update_variants()
}

// Add new html elements to pages with variant tables
function update_page_html(){
    // First check that gnomad page contains variants table (e.g. it's a gene or transcript page)
    if(document.getElementById('variant_table')){
        // Update Allele Freqency column header with population abbreviations and colours
        var af_th = document.getElementById('th-af');
        var header_div = af_th.firstChild;
        header_div.innerHTML += '<br>(<font color="#6aa5cd">EUR</font> <font color="#1b77b7">FIN</font> <font color="#942194">AFR</font> <font color="#ed2324">AMR</font> <font color="#ff9912">SAS</font> <font color="#108c43">EAS</font> <font color="#ff7f50">ASJ</font>)</div></th>';

        // Update each row in the table with div for pop AF stacked bar plot
        variants_rows = document.getElementsByClassName('table_variant');

        for (var i = 0; i < variants_rows.length; i++) {
            var variants_row = variants_rows[i]
            var td_af = variants_row.querySelector('#td-af');
            var freq_box = td_af.getElementsByTagName('div')[0]
            freq_box.innerHTML += ' <div class="table-allele-pop-freq-box" id="variant_pop_af_box_' + variants_row.getAttribute('variant_id') + '" style="float: left; font-family: monospace;"></div>'
        }

        // Update buttons which triggers original update_variants method,
        // to execute modified update_variants after that
        all_btn = document.getElementById('consequence_all_variant_button')
        all_btn.onclick = update_variants
        miss_lof_btn = document.getElementById('consequence_missenseAndLof_variant_button')
        miss_lof_btn.onclick = update_variants
        lof_btn = document.getElementById('consequence_lof_variant_button')
        lof_btn.onclick = update_variants

        exome_cb = document.getElementById('exome_checkbox')
        exome_cb.onclick = update_variants
        genome_cb = document.getElementById('genome_checkbox')
        genome_cb.onclick = update_variants
        snp_cb = document.getElementById('snp_checkbox')
        snp_cb.onclick = update_variants
        indel_cb = document.getElementById('indel_checkbox')
        indel_cb.onclick = update_variants
        filtered_cb = document.getElementById('filtered_checkbox')
        filtered_cb.onclick = update_variants
    }
}

// Draws population allele frequency stacked bar plot with tooltip
function update_variant_pop_af_box(variant_id, variant) {
    var pop_name_codes = {'European (Non-Finnish)': 'EUR', 
                         'European (Finnish)': 'FIN',
                         'African': 'AFR',
                         'Latino': 'AMR',
                         'South Asian': 'SAS',
                         'East Asian': 'EAS',
                         'Ashkenazi Jewish': 'ASJ',
    }

    var pop_colors = {
        'EUR': '#6aa5cd',
        'FIN': '#1b77b7',
        'AFR': '#942194',
        'AMR': '#ed2324',
        'SAS': '#ff9912',
        'EAS': '#108c43',
        'ASJ': '#ff7f50',
    }

    // Stacked bar plot properties
    var width = 115;
    var height = 15;

    // Used to scale proportions (from 0 to 1) to actual width (from 0 to 115)
    var x_scale = d3.scale.linear()
        .domain([0, 1])
        .range([0, width]);

    // Select element to draw stacked bar plot as svg image (external lib is used)
    var svg;
    svg = d3.select('#variant_pop_af_box_' + variant_id.replace('*', 'star'))
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g");
   
    // Calculate pop afs
    var pop_afs = {};
    var total_af = 0;
    for (var pop in pop_name_codes){
        if (variant.pop_acs[pop] > 0){
            pop_afs[pop] = variant.pop_acs[pop] / variant.pop_ans[pop];
            total_af += pop_afs[pop];
        }
        else{
            pop_afs[pop] = 0;
        }
    }

    // Tooltip table headers
    var tooltip = " Pop  |   AC   |  Hom  |     AF     \n";
    tooltip += "-----------------------------------\n";

    var previous_block_end = 0;
    for (var pop in pop_name_codes){
        var pop_af = '0.0000000';
        if (pop_afs[pop] >= 0.0000001){
            pop_af = pop_afs[pop].toFixed(7);
        }
        else if(pop_afs[pop] > 0){
            pop_af = pop_afs[pop].toExponential(4); 
        }
        // Add tooltip row
        tooltip += pop_name_codes[pop] + " | ";
        tooltip += String("         " + variant.pop_acs[pop]).slice(-6) + " | ";
        tooltip += String("        " + variant.pop_homs[pop]).slice(-5) + " | " + pop_af + "\n";

        
        if (pop_afs[pop] > 0){
            // Calculate pop af proportion which determines block width
            var block_width = pop_afs[pop] / total_af;
            // Add pop AF block to the stacked bar plot
            svg.append('rect')
                    .style('stroke', pop_colors[pop_name_codes[pop]])
                    .style('fill', pop_colors[pop_name_codes[pop]])
                    .attr('x', previous_block_end)
                    .attr('y', 0)
                    .attr('height', height)
                    .attr('width', x_scale(block_width))
            previous_block_end += x_scale(block_width)
        }
    }
    // If variant is present only in Other population show empty plot
    if (previous_block_end == 0){
        svg.append('rect')
                .style('stroke', 'steelblue')
                .style('fill', 'white')
                .attr('x', 0)
                .attr('y', 0)
                .attr('height', height)
                .attr('width', x_scale(1))
    }

    // Update tooltip with data for Other population which is not shown on the plot
    other_pop_af = '0.0000000'
    if (variant.pop_acs['Other'] > 0){
        other_pop_af = variant.pop_acs['Other'] / variant.pop_ans['Other'];
        other_pop_af = other_pop_af.toFixed(7);
    }

    tooltip += "OTH | " + String("         " + variant.pop_acs['Other']).slice(-6) + " | ";
    tooltip += String("        " + variant.pop_homs['Other']).slice(-5) + " | " + other_pop_af + "\n";
    tooltip += '* Other (OTH) population is not\n';
    tooltip += 'shown on the stacked bar plot.';
    // Add tooltip
    d3.select('#variant_pop_af_box_' + variant_id.replace('*', 'star')).attr("data-tooltip", tooltip);
}

// *********** START of exac.js Code *********** //
/*
  MODIFIED code from exac.js, this version of update_variants runs
  AFTER original update_variants function on the website has  updated 
  table with variants and updates only new added pop freq stacked bars
*/
function update_variants() {
    var category = $('.consequence_display_buttons.active')
        .attr('id')
        .replace('consequence_', '')
        .replace('_variant_button', '');
    var filterState = $('#filtered_checkbox').is(":checked")
    var indelState = $('#indel_checkbox').is(":checked")
    var snpState = $('#snp_checkbox').is(":checked")
    var exomeState = $('#exome_checkbox').is(":checked")
    var genomeState = $('#genome_checkbox').is(":checked")
    var dataSelection = getDataSelection(exomeState, genomeState)
    $('[variant_id]').hide()
    if (dataSelection === 'all' && filterState) {
        $('.data-indicator-child').show()
    } else if (dataSelection === 'all' && !filterState) {
        $('.data-indicator-child').hide()
        $('.data-indicator-child.label-success').show()
    } else {
        $('.data-indicator-child').hide()
        $('.data-indicator-' + dataSelection).show()
    }
    var windowVariables = retrieveWindowVariables(["table_variants"])
    var table_variants = windowVariables.table_variants
    $('[variant_id]').map(function(i) {
        var variant_id = $(this).attr('variant_id')
        var variant = table_variants.find(function(v) { return v.variant_id === variant_id })
        if (!snpState && $(this).attr('indel') === 'false') {
            return
        }
        if (!indelState && $(this).attr('indel') === 'true') {
            return
        }
        if (!_.contains(categoryDefinitions[category], $(this).attr('major_consequence'))) {
            return
        }
        if (!variant[dataSelection] ) {
            return
        }
        if (dataSelection !== 'all'
            && !filterState
            && variant[dataSelection].filter !== 'PASS') {
            return
        }
        if (dataSelection === 'all'
            && !filterState
            && variant.pass !== 'all'
        ) {
            if (variant.pass === 'none') {
                return
            }
            variant = Object.assign({}, variant, { all: variant[variant.pass] })
        }
        // Update happens here
        $(this).find('.table-allele-pop-freq-box').empty()
        update_variant_pop_af_box(variant_id, variant[dataSelection])
        $(this).show()
    })   
}

// UNMODIFIED code from exac.js, required to use update_variants method
var csq_order = [
    'transcript_ablation',
    'splice_acceptor_variant',
    'splice_donor_variant',
    'stop_gained',
    'frameshift_variant',
    'stop_lost',
    'start_lost',  // new in v81
    'initiator_codon_variant',  // deprecated
    'transcript_amplification',
    'inframe_insertion',
    'inframe_deletion',
    'missense_variant',
    'protein_altering_variant',  // new in v79
    'splice_region_variant',
    'incomplete_terminal_codon_variant',
    'stop_retained_variant',
    'synonymous_variant',
    'coding_sequence_variant',
    'mature_miRNA_variant',
    '5_prime_UTR_variant',
    '3_prime_UTR_variant',
    'non_coding_transcript_exon_variant',
    'non_coding_exon_variant',  // deprecated
    'intron_variant',
    'NMD_transcript_variant',
    'non_coding_transcript_variant',
    'nc_transcript_variant',  // deprecated
    'upstream_gene_variant',
    'downstream_gene_variant',
    'TFBS_ablation',
    'TFBS_amplification',
    'TF_binding_site_variant',
    'regulatory_region_ablation',
    'regulatory_region_amplification',
    'feature_elongation',
    'regulatory_region_variant',
    'feature_truncation',
    'intergenic_variant',
    ''
]

var categoryDefinitions = {
  all: csq_order,
  lof: csq_order.slice(0, csq_order.indexOf('stop_lost')),
  missense: csq_order.slice(
      csq_order.indexOf('stop_lost'),
      csq_order.indexOf('protein_altering_variant')
  ),
}
categoryDefinitions.missenseAndLof =
    categoryDefinitions.lof.concat(categoryDefinitions.missense)

function getDataSelection(exomeState, genomeState) {
    if (exomeState && genomeState) {
      return 'all'
    }
    if (exomeState && !genomeState) {
      return 'ExAC'
    }
    if (!exomeState && genomeState) {
      return 'gnomAD'
    }
}

 function renderAlleleFrequency(allele_frequency) {
    var frequency = Number(allele_frequency)
    if (frequency === 0) {
        return 0
    }
    else if (frequency >= 0.0001) {
        return frequency.toPrecision(4)
    } else {
        return Number(frequency.toPrecision(4)).toExponential()
    }
}
// *********** END of exac.js Code *********** //

// Run main method
main();