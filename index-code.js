// Copyright 2020 Carlos Ureña
// under the terms of MIT License: 

// ----------------------------------------------------------------------------
// Trying to follow JSDoc guidelines: https://jsdoc.app/
// Global state vars

// is true when raw data is being loaded
var loading  = false

// raw text with all the file contents (String)
var raw_text = null

 // XMLHttpRequest object used to send a query for the raw CSV file
var request             

// empty dictionary with country codes as keys (3 chars) and 'Country' objects
var countries = new Map()  

// array with countries codes (can be sorted to run over
// countries in some specific order)
var ordered_countries_codes = [] 

// dictionary with box numbers as keys and GraphBoxData elements instances as objects
var graph_boxes = new Map()   

// counter for the number of graph boxes created so far
var num_graphs = 0    

 // saved previous text in "load" button (can be local?? yes---)
var nlb_prev_text        

// dictionary with continent objects. keys are continents names, values are continents objects
var continents = new Map()


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
/** 
 * Table for a variable (deaths/cases) for a country or continent
 */

class DataTable
{
   /**  Constructor
   */
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
/** 
 * Class for objects with data about each country found in the raw text file
 */

class Country
{
   /** 
    * Constructor
    * @param {String}  p_code        -- three letters string with country code, non-empty, non- null
    * @param {String}  p_name        -- columns of the first country line seen in the raw text
    * @param {Number}  p_population  -- country population
    * @param {Continent} p_continent -- reference to 'Continent' object
    */
   constructor( p_code, p_name, p_population, p_continent )
   {
      CheckType( p_continent, "Continent" )

      this.id            = p_code
      this.name          = p_name  //--> columns[6]
      this.population    = p_population // --> columns[9]
      this.total_cases   = 0    // integer
      this.total_deaths  = 0    // integer
      this.population    = 0    // integer
      this.lines         = []   // array of DataLines instances
      this.deaths_table  = null // DataTable instance
      this.cases_table   = null // DataTable instance

      // add country to 'countries' dictionary
      countries[p_code] = this ;
      //countries.set( p_code, this )
      ordered_countries_codes.push( p_code ) // still not ordered, of course...

      // add country population to continent population
      p_continent.population += p_population
   }
}

// ------------------------------------------------------------------------
/** 
 * Class for objects with data about each continent found in the raw text file
 */

class Continent
{
   /**
    * Constructor
    * @param {String} p_name -- continent name
    */
   constructor( p_name )
   {
      console.log(`new continent, name == ${p_name}`)
      this.name          = p_name
      this.population    = 0
      this.total_cases   = 0    // integer
      this.total_deaths  = 0    // integer
      this.deaths_table  = null // DataTable instance
      this.cases_table   = null // DataTable instance
      // add the column to the continents dictionary
      continents.set( p_name, this )
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
/**
 * returns the year day for dates in 2020
 * for dates in 2019 returns -1
 * for dates with year sbefore 2019 or after 2021 throws an error !
 *
 * @param {Number} year  - year number (integer, 2019 o 2020)
 * @param {Number} month - month number in the year (1 to 12)
 * @param {Number} month_day - day number in the month (1 to 29,30 or 31, depending on 'month')
 */
function YearDay2020( year, month, month_day )
{
   if ( year == 2019 )
      return -1

   if ( year < 2019 || 2020 < year )
      throw RangeError("Invalid value: year == "+year.toString())
      
   if ( month < 1 || 12 < month )
      throw RangeError("Invalid value: month == "+month.toString())
      
   if ( month_day < 1  || 31 < month_day )
      throw RangeError("Invalid value: month_day == "+month_day.toString())
      
   var month_days = [ 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 ] // (non leap-year)
   if ( month_days[month-1] < month_day )
      throw RangeError("Invalid value: month == "+month.toString()+", but month_day == "+month_day.toString())
         
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
   let footer_t = document.getElementById('footer-time')
   if ( footer_t != null )
      footer_t.innerHTML = Date().toLocaleString()
   let footer_url = document.getElementById('footer-url')
   if ( footer_url != null )
      footer_url.innerHTML = window.location
}
//------------------------------------------------------------------------
/**
 * Actions performed when page is loaded
 */
function OnDocumentLoad()
{
   // sets the footer contents
   SetFooter()
   OnWindowResize()
   // install event handlers for graphs resizing when the layout may have changed
   window.ondeviceorientation = function() { OnWindowResize() }
   window.onresize            = function() { OnWindowResize() }

   
}
//-----------------------------------------------------------------------
/**
 * Called when window is resized or when orientation chenges in a mobile device.
 * Also at the begining after document load
 */
function OnWindowResize()
{
   // check for all child nodes inside 'countries-table-external-width'
   SetTableDivElementsWidth()
   
   // redraws every graph box
   //console.log(`OnWindowResize : window width == ${window.innerWidth}, height == ${window.innerHeight}`)
   UpdateGraphBoxes() 
}
//------------------------------------------------------------------------
// 
/** 
 * Set the width of all the elements of class 'setw' (inside 'countries-table-external-width')
 */
function SetTableDivElementsWidth( )
{
   let div_elem = document.getElementById('countries-table-external-div')
   if ( div_elem == null )
      throw RangeError("Cannot find  'countries-table-external-div' element")
   let 
      doc_w       = window.innerWidth,
      set_w       = Math.max( 300, Math.min( 400, Math.floor( 0.3*doc_w ))),
      w_str_par   = (set_w.toString()) +"px",
      w_str_ch    = (Math.floor(set_w*0.92)).toString() +"px"
      children_l  = div_elem.children 

  
   div_elem.style.width = w_str_par 
   
   // adjust the footer width so it is equal to the intro width
   let intro_elem = document.getElementById('intro-inner-div')
   let foot_elem  = document.getElementById('footer-inner-div')
   let str        = intro_elem.offsetWidth.toString() + "px" ;
   foot_elem.style.width = str

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

   // test: run over all continents
   for( let continent in continents.values() )
   {
      console.log(`continent: name=${continent.name}, pop == ${continent.population}`)
   }

   // run over all countries
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
      let short_name = country.name.substring( 0, Math.min(12,country.name.length) )
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
      // skip first row (includes headers)
      if ( first ) 
      {  first = false
         continue
      }

      // split CSV line, get 'columns' (array of strings)
      let columns = text_line.split(',')  

      // create the continent object, if this is the first time seen
      let continent_name = columns[10]
      

      if ( continent_name == null || continent_name == "" )
          continent_name = "Unknown continent"
      
      let continent = null
      if ( ! continents.has( continent_name ) )
         continent = new Continent( continent_name ) // adds the object to 'continents'
      else 
         continent = continents.get( continent_name )

      // create the country object, if this is the first time seen

      let country_code       = columns[8],  /// 9th column: --> country code
          country_name       = columns[6],
          country_population = parseInt(columns[9])

      if ( country_code == null || country_code == "" )
      {   country_code = "UUU"
          country_name = "Unknown country"
      }

      let country = countries[country_code]
      if ( country == null  )
         country = new Country( country_code, country_name, country_population, continent )

      
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

   // log
   console.log("Data loaded ok.")

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
      console.log("Already loading !!") 
      return 
   }
   var nlb = document.getElementById('load-button')
   nlb_prev_text = nlb.innerHTML
   nlb.innerHTML = 'Loading data. Please wait.' ;
   loading = true ;
   console.log("Starting load....");

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
   let tm   = ctx.measureText(text)
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
/**  
 * Draws a country graph 
 * @param {Country} country - object instance with country data
 * @param {String}  p_variable_name - name of country's variable to show ('cases','deaths')
 * @param {CanvasRenderingContext2D} ctx - canvas context object where to draw onto
 * @param {Number} - integer, width of the canvas
 * @param {Number} - integer, height of the canvas
 */

function DrawCountryTableGraph( country, p_variable_name, ctx, csx, csy )
{
   CheckType( country, 'Country' )

   let table = null
   if ( p_variable_name == 'cases')
      table = country.cases_table
   else if ( p_variable_name == 'deaths' )
      table = country.deaths_table
   else
     throw RangeError(`DrawCountryTableGraph: cannot draw table: variable name is incorrect ('${p_variable_name}')`)

   CheckType( table, "DataTable" )
   CheckDataVariableName( table.variable_name )

   //console.log("DrawTable: begin, max == "+table.max_value+", length== "+table.values.length )
   let values     = table.values
   let avg_values = table.avg_values
   let max_value  = table.max_value   // REVIEW (unnecesary variables, use instance variable directly)

   

   // Compute bars colors 'barColor_odd' y 'barColor_even'
   let r0 = 40.0, g0 = 40.0, b0 = 40.0
   if ( table.variable_name == 'deaths' ) // increase red for 'deaths'
      r0 = Math.min( 100.0, 2.5*r0 )

   let f  = 0.7,
       t  = (1.0-f)*100.0,
       r1 = f*r0 + t, 
       g1 = f*g0 + t, 
       b1 = f*b0 + t 

   let barColor_odd  = ColorStr(r0,g0,b0,100.0),
       barColor_even = ColorStr(r1,g1,b1,100.0)

   //console.log(" colors == "+barColor_odd+",  "+barColor_even )
   // draw grid

   let b = 0
  

   // compute 'h': vertical spacing between horizontal bars (in units of the table values)
   // (as a function of 'max_value')

   let h      = 1,
       each_h = 1    // one of each 'each_h' horizontal bars have a value label

   if ( 15 < max_value  )
   {  
      let l = 1+ Math.floor(Math.log10( max_value/10 ))
      h = Math.pow( 10, l )
      each_h = 2
      if ( max_value/h < 5 )
         h = h/5
      //console.log(`DrawCountryTableGraph: h = ${h}, max_value = ${max_value}`)
   }
   
   // compute the font size for the number labels,
   // as a function of 'csx' and 'csy'
   let min_dim   = Math.min( csx, csy ),
       font_size = Math.min( 20, Math.round( Math.max( 12, min_dim/20 )))

   let h_count = 0

   let margin_x = 0.05*csx // margin for the bars at left and right of the canvas (<csx)
   let margin_y = 0.05*csy // margin for the bars at the top and the bottom (<csy)
   let sfac_y   = csy-2.0*margin_y // scale factor in Y, accounting for the margin for margin
   let y0       = csy-margin_y  // 'y' for a zero value
   let dist_x   = (csx-2.0*margin_x)/values.length // dist in x between bars centers
   let cur_x    = margin_x+ 0.5*dist_x   // current 'x'
   let bwf      = 0.7    // ratio of horiz. distance between bars which is ocuppied by the bars (<1.0)
   let hbw      = bwf*(0.5*dist_x)      // half bar width

   // draw the horizontal bars, and their labels to the left

   for( cur_y = 0 ; cur_y <= max_value ; cur_y = cur_y + h )
   {
      let py = y0 - sfac_y*(cur_y/max_value)
      ctx.beginPath()
      ctx.moveTo(b,py); ctx.lineTo(csx,py)
      ctx.lineWidth = 1
      ctx.strokeStyle = 'rgb(180,180,180)'
      ctx.stroke()

      //if ( h_count > 0 )
      if ( h_count % each_h == 0 )
         DrawText( ctx, font_size, b, py, cur_y.toString() )
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
      ctx.fillRect( cur_x-hbw, y0, 2.0*hbw, -v*sfac_y )
      cur_x = cur_x+dist_x

      //console.log("DrawTable, i == "+(i.toString())+", val == "+(values[i].toString())+", avg.val == "+(avg_values[i].toString()))
   }


   // draw average curve
   ctx.lineWidth = 4
   ctx.strokeStyle = 'rgb(30.123%,0%,0%)'
   let first = true ;

   ctx.beginPath()
   cur_x = margin_x+ 0.5*dist_x
   for( let i = 0 ; i < avg_values.length ; i++ )
   {
      let v  = avg_values[i]/max_value,
          px = cur_x, 
          py = y0 - v*sfac_y

      if ( i == 0 ) ctx.moveTo( px, py )
      else          ctx.lineTo( px, py )

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

// function DrawCountryGraph( country, p_variable_name, ctx, csx, csy  )
// {
//    // CheckType( country, 'Country' )

//    // let table = null
//    // if ( p_variable_name == 'cases')
//    //    table = country.cases_table
//    // else if ( p_variable_name == 'deaths' )
//    //    table = country.deaths_table
//    // else
//    // {  alert("DrawCountryGraph: cannot draw table: variable name is incorrect ('"+p_variable_name+').')
//    //    return

//    // }

//    DrawCountryTableGraph( country, p_variable_name, ctx, csx, csy )
// }
// ------------------------------------------------------------------------
/** 
 * Redraws each country graph box (calls 'UpdateGraphBox')
 */

function UpdateGraphBoxes() 
{
   CheckType( graph_boxes, 'Map' )
   //console.log(`UpdateGraphBoxes, graph_boxes.size == ${graph_boxes.size}`)
   for( let [box_num,graph_box] of graph_boxes )
   {
      //console.log(`UpdateGraphBoxes: graph_box==${graph_box}`)
      UpdateGraphBox( graph_box )
   }
}
// ------------------------------------------------------------------------
/** 
 * Redraws the graph inside a graph box (calls 'DrawCountryTableGraph')
 * @param {GraphBoxData} box_data - attributes and params for the graph box we want to redraw
 */

function UpdateGraphBox( box_data )  
{
   CheckType( box_data, 'GraphBoxData' )
   //console.log(`UpdateGraphBox, box_num == ${box_data.box_num}`)
   
   let box_num_str   = box_data.box_num.toString()
   let div_idstr     = 'graph-canvas-div-'+box_num_str
   let canv_div      = document.getElementById( div_idstr )
   let canvas_idstr  = 'graph-canvas-'+box_num_str 
   let canv_doc      = document.getElementById( canvas_idstr )
   let ctx_doc       = canv_doc.getContext('2d')

   // resize the document canvas ...
   if ( canv_div.clientWidth == 0 || canv_div.clientHeight == 0 )
   {
      console.log("UpdateGraphBox - canv_div is 0-sized, won't redraw")
      return
   }
   canv_doc.width  = canv_div.clientWidth
   canv_doc.height = canv_div.clientHeight

   // create the aux canvas (this is specific to the drawing operation...???)
   let canv_aux      = document.createElement('canvas') // REVIEW : do this once, not many times
   canv_aux.width    = canv_doc.width
   canv_aux.height   = canv_doc.height
   
   let ctx_aux       = canv_aux.getContext('2d')
   //let n_box_head    = document.getElementById('graph-head-'+box_data.box_num.toString())

   if ( canv_doc == null || ctx_doc == null ||
        canv_aux == null || ctx_aux == null || 
        canv_div == null )
      throw RangeError("error! UpdateGraphBox: unexpected error -- cannot draw graph")
      
   // draw the country graph onto the aux canvas, then copy that canvas onto the doc canvas
   //n_box_head.innerHTML = country.name+' ('+box_data.variable_name+')'
   DrawCountryTableGraph( box_data.country,  box_data.variable_name, ctx_aux, canv_doc.width, canv_doc.height )
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
   n_head.innerHTML   = "<b>"+box_data.country.name+"</b> ("+box_data.variable_name+")"
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
   n_gc.appendChild( n_box )        // add the box to the document (at the end)
   //n_gc.insertBefore( n_box, n_gc.firstChild); // add the box to the element (at the begining)
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

      let 
         box_node       = mutation.target,
         box_id_words   = box_node.id.split('-'),
         box_num_str    = box_id_words[2], // get thrid word (box number)
         canvas_node    = document.getElementById("graph-canvas-"+box_num_str)
      
      if ( canvas_node == null )
         throw RangeError(`canvas node not found for box num == ${box_num_str}`)
      

      // redraw the graph box
      if ( canvas_node.width == 0 || canvas_node.height == 0 )
         return

      let box_num = parseInt( box_num_str, 10 )
      if ( ! graph_boxes.has(box_num))
         throw RangeError(`graph_boxes dict. does not includes key ${box_num}`)
      UpdateGraphBox( graph_boxes.get(box_num) )      
   }
}
// -------------------------------------------------------------------------

function AddGraphBox( p_country_code, variable_name )
{
   if ( ordered_countries_codes.length == 0 )
   {  
      if ( is_loading )
         alert("Please wait for the data to be fully loaded.")
      else
         alert("Please load data before adding a graph.")
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
      alert(`Error! - in 'RemoveGraphBox': document node with id '${id}' not found.`)

   if ( ! graph_boxes.has( graph_num ) )
   {
      alert(`Error! -in 'RemoveGraphBox': 'graph_boxes' has no key ${graph_num}`)
      return 
   }

   // remove from 'graph_boxes' dictionary
   graph_boxes.delete( graph_num ) 
}
