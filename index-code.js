// Copyright 2020 Carlos Ureña
// under the terms of MIT License: 

// ----------------------------------------------------------------------------
// Trying to follow JSDoc guidelines: https://jsdoc.app/
// Global state vars

var loading       = false
var raw_text      = null
var request              // XMLHttpRequest object used to send a query for the raw CSV file
var countries      = new Map()  // empty dictionary with country codes as keys (3 chars) and 'Country' objects
var ordered_countries_codes = [] // array with countries codes (can be sorted to run over
                          //countries in some specific order)
var graph_boxes    = new Map()   // dictionary with box numbers as keys and GraphBoxData elements instances as objects
var num_graphs     = 0    // counter for the number of graph boxes created so far
var nlb_prev_text         // saved previous text in "load" button (can be local?? yes---)

// ------------------------------------------------------------------------
/** Class represeting a data line with date, new deaths count, and new cases 
 *  count for a country 
 */

class DataLine
{
   /**  Constructor
   *   @param {Country}       country - Country object
   *   @param {Array<String>} columns - A string for each column in the original raw file
   */

   constructor( country, columns )
   {
      this.year        = parseInt(columns[3])
      this.month       = parseInt(columns[2])
      this.month_day   = parseInt(columns[1])
      this.year_day    = YearDay2020( this.year, this.month, this.month_day )
      this.week        = WeekNum2020( this.year_day )
      this.new_cases   = parseInt(columns[4])
      this.new_deaths  = parseInt(columns[5])
   }
}
// ------------------------------------------------------------------------
// a table for a variable (deaths/cases)

class DataTable
{
   constructor()
   {
      this.start_year_day = 0    // date of first number, (year day in 2020)
      this.variable_name  = ''    // 'deaths', 'cases', or others...
      this.max_value      = 0
      this.values         = []
      this.avg_values     = []
      this.week_num       = []  // for each entry in the table, week number in the year
      this.avg_width      = 7
   }
}
// ------------------------------------------------------------------------

class Country
{
   // Constructor
   // country_code == three letters string with country code, non-empty, non- null
   // columns      == array with strings, one per each row in the raw CSV text line

   constructor( country_code, columns )
   {
      this.id            = country_code
      this.name          = columns[6]
      this.population    = parseInt(columns[9])
      this.total_cases   = 0    // integer
      this.total_deaths  = 0    // integer
      this.population    = 0    // integer
      this.lines         = []   // array of DataLines instances
      this.deaths_table  = null // DataTable instance
      this.cases_table   = null // DataTable instance

      // add to data structures referencing the countries
      countries[country_code] = this ;
      ordered_countries_codes.push( country_code )
   }
}

// ------------------------------------------------------------------------

class GraphBoxData
{
   constructor( country, p_variable_name )
   {
      CheckType( country, 'Country' )
      CheckDataVariableName( p_variable_name )

      // increase global graph count
      num_graphs = num_graphs+1

      // populate this object
      this.box_num           = num_graphs
      this.country           = country
      this.variable_name     = p_variable_name
      this.box_node          = null
      this.box_node          = CreateGraphBoxElement( this )

      // add to 'graph_boxes' dictionary
      graph_boxes.set( this.box_num, this )

      // draw the graph in the canvas
      UpdateGraphBox( this )
   }
}

// ------------------------------------------------------------------------
// check if an object type or class name is equal to the expected one.
// if it is not, throws a type error

function CheckType( obj, expected_type_name )
{
   if ( obj == null )
      throw TypeError("object is 'null'")

   let obj_type_name = typeof(obj)
   if ( obj_type_name == 'object' )
      obj_type_name = obj.constructor.name

   if ( obj_type_name == expected_type_name )
      return

   let msg = "object is not a '"+expected_type_name+"', but a '"+obj_type_name+"'"
   throw TypeError( msg )
}

// ------------------------------------------------------------------------
// check if a data variable name is valid or not

function CheckDataVariableName( variable_name )
{
   var valid_names = ['deaths','cases']
   if ( valid_names.includes( variable_name ) )
      return

   throw RangeError("Data variable name '"+variable_name+"' is invalid, must be one of: "+(valid_names.toString()))
}

// ------------------------------------------------------------------------
// returns the year day for dates in 2020
// for dates in 2019 or before, returns -1
// for dates in 2021, raises an error !

// year  == year number (integer, 2019 o 2020)
// month == month number in the year (1 to 12)
// month_day == day number in the month (1 to 29,30 or 31, depending on 'month')

function YearDay2020( year, month, month_day )
{
   if ( year == 2019 )
      return -1

   if ( year < 2019 || 2020 < year )
   {  console.log("Error! in 'YearDay' - year == "+year.toString())
      return -2
   }
   if ( month < 1 || 12 < month )
   {  console.log("Error! in 'YearDay' - month == "+month.toString())
      return -3
   }
   if ( month_day < 1  || 31 < month_day )
   {  console.log("Error! in 'YearDay' - month_day == "+month_day.toString())
      return -4
   }
   var month_days = [ 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 ] // (non leap-year)
   if ( month_days[month-1] < month_day )
   {
      console.log("Error! in 'YearDay' - month == "+month.toString()+", but month_day == "+month_day.toString())
         return -5
   }

   let sum = 0
   for( let m = 1 ; m < month ; m++ )
      sum = sum + month_days[m-1]

   return sum + month_day
}
//------------------------------------------------------------------------
/**
 * Sets the text in the web page footer (after the hrule at the end)
 */
function SetFooter()
{
   let footer = document.getElementById('footer')
   if ( footer != null )
      footer.innerHTML = "Page served: "+Date().toLocaleString()
}
//------------------------------------------------------------------------
/**
 * Actions performed when page is loaded
 */
function OnDocumentLoad()
{
   // sets the footer contents
   SetFooter()
   // install event handler for window resizing
   window.ondeviceorientation = function() { OnWindowResize() }
   window.onresize            = function() { OnWindowResize() }
}
//-----------------------------------------------------------------------
/**
 * Called when window is resized or when orientation chenges in a mobile device
 */
function OnWindowResize()
{
   console.log("OnWindowResize")

   // TODO: resize every graph box ????
   // redraws every graph box
   UpdateGraphBoxes() 
}
//------------------------------------------------------------------------
// 
/** Returns natural week number for a day in 2020.
 *  @param   {Number}  year_day -  the day number (Jan 1 )
 *  @returns {Number} - 0 for Jan 1 (Tuesday) to Jan 5 (Sunday), 1 for Jan 6-12, and so on...
 */
function WeekNum2020( year_day )
{
   if ( year_day < 6 )
      return 0
   return 1 + Math.floor( (year_day-6) / 7 )
}
// ------------------------------------------------------------------------
/**
 * Compare two countries using its total death count
 * @param   {String} cca - country code for first country
 * @param   {String} ccb - country code for second 
 * @returns {Number} - negative, cero or positive, according to numbers of deaths 
 */
function CompareCountriesDeathsDescending( cca, ccb )
{
   let ca = countries[cca],
       cb = countries[ccb] ;

   return cb.total_deaths - ca.total_deaths
}
// ------------------------------------------------------------------------
/**
 * Compare two 'DataLine' objects by using their dates
 * @param   {DataLine} la - first data line
 * @param   {DataLine} lb - second data line
 * @returns {Number} - negative, cero or positive, according to 'year_day' property
 */
function CompareLinesDatesAscending( la , lb )
{
  return la.year_day - lb.year_day
}
// -----------------------------------------------------------------------
/**
 * Resets and then adds all rows to the countries table web page element
 * (id = 'countries-table-body')
 */
function PopulateCountriesTable()
{
   // get and rest the table element
   let n_table = document.getElementById('countries-table-body')
   CheckType( n_table, 'HTMLTableSectionElement' )

   n_table.textContent = ''

   for( let code of ordered_countries_codes )
   {
      var country = countries[code]
      if ( country == null )
      {
         console.log("code '"+code+"' has no country in 'countries' (shouldn't happen)")
         continue
      }
      
      var n_code      = document.createElement('td')
      var n_name      = document.createElement('td')
      var n_cases     = document.createElement('td')
      var n_deaths    = document.createElement('td')

      n_cases.className  = 'cases-cell'
      n_deaths.className = 'deaths-cell'

      //n_code.appendChild( document.createTextNode( country.id ) )
      let short_name = country.name.substring( 0, Math.min(15,country.name.length) )
      n_name.appendChild  ( document.createTextNode( short_name ) )

      let country_cap = code

      n_cases.appendChild ( document.createTextNode( country.total_cases.toString() ) )
      n_cases.onclick  = function(){ OnCountryCasesClicked(country_cap) }

      n_deaths.appendChild( document.createTextNode( country.total_deaths.toString() ) )
      n_deaths.onclick  = function(){ OnCountryDeathsClicked(country_cap) }

      var n_row = document.createElement('tr')

      //n_row.appendChild( n_code )
      n_row.appendChild( n_name )
      n_row.appendChild( n_cases )
      n_row.appendChild( n_deaths )

      n_table.appendChild( n_row  )

      //console.log(code+" :",country.name, ", deaths ",country.total_deaths, ", cases ",country.total_cases, ", popul. ",country.population )
   }
}

// -----------------------------------------------------------------------
/**
 * Resets and then adds all rows to the countries table web page element
 * resets 'countries', 'countries_codes', 'ordered_countries_codes' , 'lines'
 * calls 'PopulateCountriesTable'
 */
function ProcessNewRawText( )
{
   // reset arrays
   countries               = new Map()
   countries_codes         = []
   ordered_countries_codes = []
   lines                   = []

   // create lines array
   let text_lines = raw_text.split('\n')
   let first      = true

   for( let text_line of text_lines )
   {
      if ( first ) // skip first row (includes headers)
      {  first = false
         continue
      }
      let columns      = text_line.split(',')  // split CSV line
      let country_code = columns[8]  /// 9th column: --> country code

      if ( country_code == null || country_code == "" )
      {  //console.log("country with name '"+columns[6]+"' has no code ? (ignored)")
         continue
      }
      let country = countries[country_code]
      if ( country == null  )
         country = new Country( country_code, columns )

      // create line, add to array with country lines
      let line = new DataLine( country, columns )
      country.lines.push( line )
      country.total_cases  += line.new_cases
      country.total_deaths += line.new_deaths
   }

   // sort 'countries' table according to some criteria (actually deaths, descending)
   ordered_countries_codes.sort( CompareCountriesDeathsDescending )

   // sort every country lines according to date, (re) compute country tables
   for( let code of ordered_countries_codes )
   {  
      let country = countries[code]
      CheckType( country, 'Country' )
      if ( country.lines.length > 0 )
      {  country.lines.sort( CompareLinesDatesAscending )
         country.deaths_table  = ComputeCountryTable( country, 'deaths')
         country.cases_table   = ComputeCountryTable( country, 'cases')
         //console.log(`country ${country.id} cases table length == ${country.cases_table.values.length}`)
      }
   }
   // (re) populate countries code
   PopulateCountriesTable()
   
   // redraw again each country graph (if any is defined)
   UpdateGraphBoxes() 

   // update text with info about the last load.
   let loadi = document.getElementById('last-load-info')
   loadi.innerHTML = "Data was last updated at: "+Date().toLocaleString()

}
// --------------------------------------------------------------------------
/**
 * Function called when the user clicks on a country deaths number
 */ 
function OnCountryDeathsClicked( country_code )
{
   //alert("clicked country: "+country_code+" (on table row)")
   AddGraphBox( country_code, 'deaths' )
}
// --------------------------------------------------------------------------
/**
 * Function called when the user clicks on a country cases number
 */ 
function OnCountryCasesClicked( country_code )
{
   //alert("clicked country: "+country_code+" (on table row)")
   AddGraphBox( country_code, 'cases' )
}
// ------------------------------------------------------------------------
/**
 * Function called when the raw CSV text data file has been loaded
 * 
 */

function OnReadyStateChangeFunction()
{
   //console.log("ORSC : ready state ==  ",request.readyState);
   if ( request.readyState != 4 ) // completed
      return ;

   raw_text = request.responseText
   request  = null

   ProcessNewRawText( )

   loading       = false ;
   var nlb       = document.getElementById('load-button')
   nlb.innerHTML = nlb_prev_text
}
// ------------------------------------------------------------------------
/**
 * Function called when there is an error while loading CSV raw data
 */ 
function OnLoadErrorFunction(event)  // not standard ??
{
   console.log("uups, an error ocurred !! ")
   console.log("event type == ",event.type)
   alert("Cannot load data file")
   loading = false ;
}
// ------------------------------------------------------------------------

function LoadFile()
{
   if ( loading )
   {
      console.log("already loading !!") 
      return 
   }
   var nlb = document.getElementById('load-button')
   nlb_prev_text = nlb.innerHTML
   nlb.innerHTML = 'Loading data ...' ;
   loading = true ;
   console.log("starting load....");

   // create and configure request

   request                    = new XMLHttpRequest();
   request.onerror            = OnLoadErrorFunction ;
   request.onreadystatechange = OnReadyStateChangeFunction ;

   // open and send request to server, we use a CORS proxy to mediate the request
   // (couldn't we do this directly??)

   var cors_proxy_url  = 'https://cors-anywhere.herokuapp.com/'
       url_to_download = 'https://opendata.ecdc.europa.eu/covid19/casedistribution/csv/'
   request.open('GET', cors_proxy_url + url_to_download , true);
   request.send();
}
// ------------------------------------------------------------------------
/**
 * Creates a country table (a table referenced from the country object)
 * @param {Country} country - country object
 * @param {String}  variable_name -- type of data: ('cases' or 'deaths') 
 */
function ComputeCountryTable( country, variable_name )
{
   CheckType( country, 'Country' )
   CheckDataVariableName( variable_name )

   let max_value       = 0.0
   let values          = []
   let first_nz_index  = -1 // index of first non-zero value in country lines (-1 if still no non-zero found)
   let nz_values_count = 0  // num of values after first non-zero value in country lines (==values length)
   let count           = 0
   let week_num        = []

   // gather lines values onto 'values' array
   for( let i = 0 ; i <  country.lines.length ; i++ )
   {
      let value = 0
      if ( variable_name == 'deaths')
         value = country.lines[i].new_deaths
      else
         value = country.lines[i].new_cases
  
      if ( 0 < value )
      {  if ( nz_values_count == 0 )
            first_nz_index = count
         if ( max_value < value )
            max_value = value
      }
      if ( -1 < first_nz_index )  // if we already got to the first non-zero value....
      {  values.push( value )     // register the value in the values array
         week_num.push( country.lines[i].week  )
      }
      count++
   }

   let days_averaged = 7  // number of days averaged for the 'average' curve

   //console.log(`ComputeCountryTable: ${country.id}, first_nz_index == ${first_nz_index} `)

   if ( -1 == first_nz_index )
   {  let table = new DataTable()
      table.variable_name  = variable_name    // 'deaths', 'cases', or others...
      table.max_value      = 0
      table.values         = []
      table.avg_values     = []
      table.avg_width      = days_averaged
      table.week_num       = []
      return table
   }

   // gather averaged day values onto 'avg_values' array
   let avg_values = []
   for( let i= 0 ; i < values.length ; i++ )
   {
      let delta = Math.floor(days_averaged/2)
      let first = Math.max( i-delta, 0 )
      let last  = Math.min( first+days_averaged-1, values.length-1 )
      let num_v = last-first+1

      let sum = 0.0
      for( let j = first ; j <= last ; j++ )
         sum = sum + values[j]

      let v = sum/num_v
      avg_values.push( v )
   }

   let table = new DataTable()

   table.start_year_day = country.lines[first_nz_index].year_day    // year day of first number, (year day in 2020)
   table.variable_name  = variable_name    // 'deaths', 'cases', or others...
   table.max_value      = max_value
   table.values         = values
   table.avg_values     = avg_values
   table.avg_width      = days_averaged
   table.week_num       = week_num // (array)

   return table
}
// ------------------------------------------------------------------------
/**
 * Create a CSS RGBA color string by using four floating point percentages
 * @param {Number} r - amount of red, in percentage (a float between 0.0 and 100.0)
 * @param {Number} g - amount of green, in percentage (a float between 0.0 and 100.0)
 * @param {Number} b - amount of blue, in percentage (a float between 0.0 and 100.0)
 * @param {Number} a - amount of opacity, in percentage (a float between 0.0 and 100.0)
 * @returns {String} - rgba CSS string with the color spec
 */
function ColorStr( r, g, b, a )
{
   let r_str = r.toString() + '%',
       g_str = ','+g.toString() + '%',
       b_str = ','+b.toString() + '%',
       a_str = ','+a.toString() +'%'

   return 'rgba('+r_str+g_str+b_str+a_str+')'
}
// ------------------------------------------------------------------------

function DrawText( ctx, font_size_px, posx, posy, text )
{
    let font_str = font_size_px.toString()+"px Crimson Pro"
    ctx.font = font_str

   //let text = "Hello World !"
   //console.log("##### DrawText: font == "+font_str )
   let tm = ctx.measureText(text)
   let boxy = tm.actualBoundingBoxAscent + tm.actualBoundingBoxDescent
   let boxx = tm.width
   let m    = 10 // margin in pixels
   let px   = posx
   let py   = posy+((m+boxy)/2)

   ctx.lineWidth = 1
   ctx.fillStyle = 'rgba(100%,100%,100%,0.92)'
   ctx.fillRect( px, py, boxx+m, - boxy-m )

   //ctx.strokStyle = 'rgb(100%,0,0)'
   //ctx.lineWidth = 2
   //ctx.strokeRect( px, py, boxx+m, - boxy-m )

   //console.log("m. x == "+boxx+" px?, y = "+boxy+" px?")

   ctx.fillStyle = 'rgb(50%,50%,50%)'
   ctx.fillText( text, px+(m/2), py-(m/2) )

   //console.log("text='"+text+"', at: x = "+px.toString()+" , y = "+py.toString() )
}
// ------------------------------------------------------------------------

function DrawTable( table, ctx, csx, csy )
{
   CheckType(table,"DataTable" )
   CheckDataVariableName( table.variable_name )

   //console.log("DrawTable: begin, max == "+table.max_value+", length== "+table.values.length )
   let values     = table.values
   let avg_values = table.avg_values
   let max_value  = table.max_value   // REVIEW (unnecesary variables, use instance variable directly)

   let dist_x = (csx-30)/values.length // dist in x between bars centers
   let cur_x  = 0.5*dist_x
   let bwf    = 0.7    // ratio of horiz. distance between bars which is ocuppied by the bars (<1.0)
   let hbw    = bwf*(0.5*dist_x)      // half bar width

   // bars colors
   let r0 = 40.0, g0 = 40.0, b0 = 40.0
   if ( table.variable_name == 'deaths' ) // increase red for 'deaths'
      r0 = Math.min( 100.0, 2.5*r0 )

   let r1 = 0.5*(r0+100.0), g1 = 0.5*(g0+100.0), b1 = 0.5*(b0+100.0)

   let barColor_odd  = ColorStr(r0,g0,b0,100.0),
       barColor_even = ColorStr(r1,g1,b1,100.0)

   //console.log(" colors == "+barColor_odd+",  "+barColor_even )
   // draw grid


   let b = 0

   // draw horizontal reference lines
   let h = 0 // spacing between horizontal bars (arbitrary limits...REVIEW)
   if ( max_value <= 100 )
      h = 20
   else if ( max_value <= 1000 )
      h = 100
   else if ( max_value <= 10000 )
      h = 500
   else if ( max_value <= 100000 )
      h = 5000
   else
      h = 10000

   let each_h = 2, h_count = 0

   let font_size = Math.round( Math.max( 10, csx/50 ))

   for( cur_y = 0 ; cur_y <= max_value ; cur_y = cur_y + h )
   {
      let py = csy*(1.0-cur_y/max_value)
      ctx.beginPath()
      ctx.moveTo(b,py); ctx.lineTo(csx-b,py)
      ctx.lineWidth = 1
      ctx.strokeStyle = 'rgb(180,180,180)'
      ctx.stroke()


      if ( h_count > 0 )
      if ( h_count % each_h == 0.0 )
      {
         DrawText( ctx, font_size, b, py, cur_y.toString() )
      }
      h_count = h_count+1
   }

   // draw values bar
   ctx.fillStyle = 'rgb(240,100,100)'
   for( let i = 0 ; i < values.length ; i++  )
   {
      let v = values[i]/max_value
      if ( (table.week_num[i] % 2) == 0 )
         ctx.fillStyle = barColor_even //'rgb(240,100,100)'
      else
         ctx.fillStyle = barColor_odd // 'rgb(256,150,150)'
      ctx.fillRect( cur_x-hbw, csy, 2.0*hbw, -csy*v )
      cur_x = cur_x+dist_x

      //console.log("DrawTable, i == "+(i.toString())+", val == "+(values[i].toString())+", avg.val == "+(avg_values[i].toString()))
   }


   // draw average curve
   ctx.lineWidth = 4
   ctx.strokeStyle = 'rgb(30.123%,0%,0%)'
   let first = true ;

   ctx.beginPath()
   cur_x = 0.5*dist_x
   for( let i = 0 ; i < avg_values.length ; i++ )
   {
      let v = avg_values[i]/max_value
      let px = cur_x, py = csy*(1.0-v)
      if ( i == 0 )
         ctx.moveTo(px,py)
      else
         ctx.lineTo(px,py)
      cur_x = cur_x + dist_x
   }

   ctx.stroke()

   // debug: text
   let debug_text = false
   if ( debug_text )
   {
      ctx.font = "32px Trebuchet MS";
      let text = "Hello World !"
      let tm = ctx.measureText(text)
      let boxy = tm.actualBoundingBoxAscent + tm.actualBoundingBoxDescent
      let boxx = tm.width

      ctx.lineWidth = 1
      ctx.fillStyle = 'rgba(100%,100%,100%,0.92)'
      ctx.fillRect( csx/2-10, csy/2+10, boxx+20, - boxy-20)

      ctx.strokStyle = 'rgb(100,0,0)'
      ctx.lineWidth = 2
      ctx.strokeRect( csx/2-10, csy/2+10, boxx+20, - boxy-20)

      //console.log("m. x == "+boxx+" px?, y = "+boxy+" px?")

      ctx.fillStyle = 'rgb(0%,0%,20%)'
      ctx.fillText("Hello World!", csx/2, csy/2)
   }

}

// ------------------------------------------------------------------------
// draws a country graph (REVIEW REMOVE this function?, use DrawTable directly)
//   country   : Country instance
//   ctx       : canvas context to draw to
//   csx, csy  : canvas size in pixels?
//   p_variable_name : either 'cases' or 'deaths'

function DrawCountryGraph( country, ctx, csx, csy, p_variable_name )
{
   CheckType( country, 'Country' )

   let table = null
   if ( p_variable_name == 'cases')
      table = country.cases_table
   else if ( p_variable_name == 'deaths' )
      table = country.deaths_table
   else
   {  alert("DrawCountryGraph: cannot draw table: variable name is incorrect ('"+p_variable_name+').')
      return

   }

   DrawTable( table, ctx, csx, csy )
}
// ------------------------------------------------------------------------
/** 
 * Redraws each country graph box (calls 'UpdateGraphBox')
 */

function UpdateGraphBoxes() 
{
   CheckType( graph_boxes, 'Map' )
   console.log(`UpdateGraphBoxes, graph_boxes.size == ${graph_boxes.size}`)
   for( graph_box of graph_boxes )
   {
      console.log(`UpdateGraphBoxes: graph_box==${graph_box}`)
      //UpdateGraphBox( graph_box )
   }
}
// ------------------------------------------------------------------------
/** 
 * Redraws the graph inside a graph box (calls 'DrawCountryGraph')
 * @param {GraphBoxData} box_data - attributes and params for the graph box we want to redraw
 */

function UpdateGraphBox( box_data )  
{
   CheckType( box_data, 'GraphBoxData' )
   console.log(`UpdateGraphBox, box_num == ${box_data.box_num}`)
   
   let idstr         = 'graph-canvas-'+box_data.box_num.toString()
   let canv_doc      = document.getElementById( idstr )
   let ctx_doc       = canv_doc.getContext('2d')
   let canv_aux      = document.createElement('canvas') // REVIEW : do this once, not many times
   canv_aux.width    = canv_doc.width
   canv_aux.height   = canv_doc.height
   let ctx_aux       = canv_aux.getContext('2d')
   //let n_box_head    = document.getElementById('graph-head-'+box_data.box_num.toString())

   if ( canv_doc == null || ctx_doc == null ||
        canv_aux == null || ctx_aux == null  )
   {
      alert("error! UpdateGraphBox: unexpected error -- cannot draw graph")
      return
   }
   // draw the country graph onto the aux canvas, then copy that canvas onto the doc canvas
   //n_box_head.innerHTML = country.name+' ('+box_data.variable_name+')'
   DrawCountryGraph( box_data.country, ctx_aux, canv_doc.width, canv_doc.height, box_data.variable_name )
   ctx_doc.drawImage( canv_aux, 0, 0 ) 

}
// ------------------------------------------------------------------------
/**
 * Create the DOM elements corresponding to a box_data, returns root div node
 * @param   {BoxData} box_data - object with the country code, box number, etc..
 * @returns {HTMLDivElement} - div with the box data
 */

function CreateGraphBoxElement( box_data )
{
   CheckType( box_data, 'GraphBoxData' )
   
   // create all the elements
   let
      ng       = box_data.box_num, // local copy of the variable (to be captured)
      ng_str   = ng.toString(),
      n_gc     = document.getElementById('graphs-container'),
      n_box    = document.createElement('div'),
      n_head   = document.createElement('span'),
      n_close  = document.createElement('span'),
      n_p      = document.createElement('p'),
      n_ca_div = document.createElement('div'),
      n_canvas = document.createElement('canvas')

   // configure the elements
   n_box.className    = 'graph-box'
   n_box.id           = 'graph-box-'+ng_str
   n_head.className   = 'graph-head'
   n_head.id          = 'graph-head-'+ng_str
   n_head.innerHTML   = box_data.country.name+" ("+box_data.variable_name+")"
   n_close.className  = 'graph-close'
   n_close.onclick    = function(){ RemoveGraphBox(ng) }  // capture ng ?? (yes)
   n_close.innerHTML  = 'X'
   n_p.innerHTML      = ''
   n_ca_div.className = 'graph-canvas-div'
   n_ca_div.id        = 'graph-canvas-div-'+ng_str
   n_canvas.className = 'graph-canvas'
   n_canvas.id        = 'graph-canvas-'+ng_str

   // create structure
   n_box.appendChild( n_head )
   n_box.appendChild( n_close )
   n_box.appendChild( n_p )
   n_box.appendChild( n_ca_div )
   //n_gc.appendChild( n_box )        // add the box to the document (at the end)
   n_gc.insertBefore( n_box, n_gc.firstChild);        // add the box to the element (at the begining)
   n_ca_div.appendChild( n_canvas )     // append canvas to canvas div

   // configure the canvas dimensions by using the enclosing div dimensions
   n_canvas.width  = n_ca_div.clientWidth
   n_canvas.height = n_ca_div.clientHeight

   // Add mutation observer, so we can track when the canvas container div is reshapped
   // from: https://developer.mozilla.org/es/docs/Web/API/MutationObserver (adapted)

   let observer = new MutationObserver( function(mutations) { HandleGraphBoxMutation(mutations) } )
   observer.observe( n_box, { attributes: true, childList: true, characterData: true } )

   return n_box
}
// ------------------------------------------------------------------------

function HandleGraphBoxMutation( mutations )
{
   for( var mutation of mutations )
   {

      if ( mutation.type != 'attributes' || mutation.attributeName != 'style')
         continue

      let box_node       = mutation.target
      let box_id_words   = box_node.id.split('-')
      let box_num        = box_id_words[2]
      let wx             = parseInt(box_node.style.width,10)
      let canvas_node    = document.getElementById("graph-canvas-"+box_num)
      let canvas_div     = document.getElementById("graph-canvas-div-"+box_num)
      canvas_node.width  = canvas_div.clientWidth
      canvas_node.height = canvas_div.clientHeight

      let debug = false
      if ( debug )
      {
         console.log("----------")
         console.log("Mutation Observer, box num == "+(box_num.toString())+", canvas_div client width == "+canvas_div.clientWidth.toString()+", client height == "+canvas_div.clientHeight.toString())

         let rect = canvas_div.getBoundingClientRect()
         console.log("rect, width  == "+rect.width.toString()+", height = "+rect.height.toString())
      }

      if ( canvas_node.width > 10 && canvas_node.height > 10 )
         UpdateGraphBox( graph_boxes.get(box_num) )

   }
}
// -------------------------------------------------------------------------

function AddGraphBox( p_country_code, variable_name )
{
   if ( ordered_countries_codes.length == 0 )
   {  alert("Please load data before adding a graph.")
      return
   }
   CheckDataVariableName( variable_name )

   // check country code
   let country_code ='ESP'
   if ( p_country_code != null && p_country_code != "" )
      country_code = p_country_code

   if ( countries[country_code] == null )
   {  alert("Error! - AddGraphBox: country code '"+country_code+"' not found.")
      return
   }

   // create a 'box data' object, this creates DOM objects and event handlers..

   let box_data = new GraphBoxData( countries[country_code], variable_name )
}
// ------------------------------------------------------------------------

function RemoveGraphBox( graph_num )
{
   var numstr = graph_num.toString()
   var id     = 'graph-box-'+numstr
   var gbn    = document.getElementById(id)

   if ( gbn != null )
   {
      var parent = gbn.parentNode
      parent.removeChild( gbn )
   }
   else
      alert("ERROR: document node '"+id+"' not found.")

   // remove from 'graph_boxes' dictionary
   graph_boxes.delete( graph_num ) 
}
