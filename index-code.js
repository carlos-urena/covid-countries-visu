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
var countries = new Map()    /// REVIEW (OK): created as a 'Map' but not used as a Map

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

// number of days averaged for the averaged graph
const days_averaged = 7  // number of days averaged for the 'average' curve


// ------------------------------------------------------------------------
/** Class represeting a data line with date, new deaths count, and new cases 
 *  count for a country 
 */

class DataLine
{
   /**  Constructor
   *   @param {Array<String>} columns - A string for each column in the original raw file 
   *   (when 'columns' is null, we initialize every field to zero)
   */

   constructor( columns )
   {
      if ( columns == null )
      {
         this.year        = 0
         this.month       = 0
         this.month_day   = 0
         this.year_day    = 0
         this.week        = 0
         this.new_cases   = 0
         this.new_deaths  = 0
      }
      else
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

      // initialize 'this' object
      this.id            = p_code
      this.name          = p_name  //--> columns[6]
      this.population    = p_population // --> columns[9]
      this.total_cases   = 0    // integer
      this.total_deaths  = 0    // integer
      this.population    = 0    // integer
      this.lines         = []   // array of DataLines instances
      this.deaths_table  = null // DataTable instance
      this.cases_table   = null // DataTable instance
      this.continent     = p_continent // link continent from country object

      // add this country to the countries map and to the ordered countries array
      if ( countries.has(p_code) )
         throw RangeError(`country code already in countries dictionary (${p_code})`)
      countries.set( p_code, this )
      ordered_countries_codes.push( p_code ) // still not ordered, of course...

      // add country population to continent population
      p_continent.population += p_population
   }
   // ----------------------------------------------------------------------
   /**
    * Adds a line to this country lines
    * @param {DataLine} line -- line to add 
    */
   addLine( line )
   {
      CheckType( line, 'DataLine')
      this.lines.push( line )
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
      let t_name = p_name.trim()
      //console.log(`new continent, name == [${t_name}]`)
      this.name          = t_name
      this.population    = 0
      this.total_cases   = 0    // integer
      this.total_deaths  = 0    // integer
      this.deaths_table  = null // DataTable instance
      this.cases_table   = null // DataTable instance
      this.lines_map     = new Map() // lines for this continent: key = year day, values=DataLine
      // add the column to the continents dictionary

      if ( continents.has(t_name) )
         throw RangeError(`cannot create continent '${t_name}', it is already in 'continents' dictionary.`)
      continents.set( t_name, this )
      //console.log(`added continent '${this.name}' to 'continents'`)
   }
   /** Adds a  line to 'lines_map' 
    * (accumulates the number of cases or deaths to the unique line in 'lines_map' for that date)
    * (creates the line and inserts it to the lines_map, if it is not already there)
    */
   accumulateLine( line )
   {
      CheckType( line, 'DataLine')
      
      // check if this year day has been already added to this continent's lines map
      let map_line = this.lines_map.get(line.year_day)

      // if it is not, create the data line for this day, and add to lines map
      if ( map_line == undefined )
      {   
         map_line = new DataLine( null )
         
         map_line.year      = line.year 
         map_line.month     = line.month
         map_line.month_day = line.month_day
         map_line.year_day  = line.year_day
         map_line.week      = line.week 

         this.lines_map.set( map_line.year_day, map_line )
      }
      // accumulate cases and deaths
      map_line.new_cases += line.new_cases
      map_line.new_deaths += line.new_deaths 
         

   }
}

// ------------------------------------------------------------------------
/** 
 * Class for a single object with data about the whole world 
 */

var world = null // world singleton

class World
{
   /**
    * Constructor
    */
   constructor( )
   {
      if ( world != null )
         throw RangeError("cannot create two 'World' instances, one is already created")

      this.name          = "World"
      this.population    = 0
      this.total_cases   = 0    // integer
      this.total_deaths  = 0    // integer
      this.deaths_table  = null // DataTable instance
      this.cases_table   = null // DataTable instance
      this.lines_map     = new Map() // lines for the world world: key = year day, values=DataLine
   }
   /** Adds a  line to 'lines_map' 
    * (accumulates the number of cases or deaths to the unique line in 'lines_map' for that date)
    * (creates the line and inserts it to the lines_map, if it is not already there)
    */
   accumulateLine( line )
   {
      CheckType( line, 'DataLine')
      
      // check if this year day has been already added to this continent's lines map
      let map_line = this.lines_map.get(line.year_day)

      // if it is not, create the data line for this day, and add to lines map
      if ( map_line == undefined )
      {   
         map_line = new DataLine( null )
         
         map_line.year      = line.year 
         map_line.month     = line.month
         map_line.month_day = line.month_day
         map_line.year_day  = line.year_day
         map_line.week      = line.week 

         this.lines_map.set( map_line.year_day, map_line )
      }
      // accumulate cases and deaths
      map_line.new_cases += line.new_cases
      map_line.new_deaths += line.new_deaths 
   }
}

// ------------------------------------------------------------------------

class GraphBoxData
{
   /**
    * Creates a 'GraphBoxData' object
    * @param {Country or Continent} p_region -- country or continent the graph box data referes to 
    * @param {*} p_variable_name -- variable ('deaths' or 'cases')
    */
   constructor( p_region, p_variable_name )
   {
      CheckDataVariableName( p_variable_name )

      if ( p_region == null )
         throw RangeError(`'p_region' is null `)

      let region_class = p_region.constructor.name
      if ( region_class != 'Country' && region_class != 'Continent')
         throw TypeError(`'p_region' is of unexpected class '${region_class}', should be 'Country' or 'Continent'`) 

      // increase global graph count
      num_graphs = num_graphs+1

      // populate this object
      this.box_num           = num_graphs
      this.region            = p_region
      this.region_class      = region_class
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
   // redraw things (needed?)
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
   const ca = countries.get( cca ), //REVIEW (OK): use 'countries' as a Map
         cb = countries.get( ccb ) 

   if ( ca == undefined || cb == undefined )
      throw RangeError(`country codes '${cca}' or '${ccb}' not found in 'countries'`)

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
 * Creates a new 'tr' element for the table with continents and countries
 * @param {String}     name -- country or continent name
 * @param {Number}     num_cases  -- total num of cases
 * @param {Number}     num_deaths  -- total num of deaths
 * @param {function()} cases_click_func  -- function called whn a click is done on the cases number
 * @param {function()} deaths_click_func -- function called when a click is done on the deaths number
 * @return {HTMLTableRowElement} -- the new HTML DOM element (type <tr>)
 */
function CreateTableRowElem( name, num_cases, num_deaths, cases_click_func, deaths_click_func )
{
   let 
      n_name   = document.createElement('td'),
      n_cases  = document.createElement('td'),
      n_deaths = document.createElement('td')

   n_cases.className  = 'cases-cell'
   n_deaths.className = 'deaths-cell'

   let short_name = name.substring( 0, Math.min(12, name.length) )
   n_name.appendChild  ( document.createTextNode( short_name ) )

   n_cases.appendChild ( document.createTextNode( num_cases.toString() ) )
   n_cases.onclick = cases_click_func

   n_deaths.appendChild( document.createTextNode( num_deaths.toString() ) )
   n_deaths.onclick = deaths_click_func

   let n_row = document.createElement('tr')

      //n_row.appendChild( n_code )
   n_row.appendChild( n_name )
   n_row.appendChild( n_cases )
   n_row.appendChild( n_deaths )

   return n_row
}

// -----------------------------------------------------------------------
/**
 * Resets and then adds all rows to the countries table web page element
 * (id = 'countries-table-body')
 */
function PopulateCountriesTable()
{
   // Get and empty the table body element
   let n_table = document.getElementById('countries-table-body')
   CheckType( n_table, 'HTMLTableSectionElement' )
   n_table.textContent = ''

   // Run over all continents, add a row for each continent
   for( let [name,continent] of continents )
   {
      let deaths_click_func = function() { OnContinentDeathsClicked( continent.name ) },
          cases_click_func  = function() { OnContinentCasesClicked( continent.name ) }

      let row_element = CreateTableRowElem( continent.name,
               continent.total_cases, continent.total_deaths,
               cases_click_func, deaths_click_func )

      n_table.appendChild( row_element )
   }

   // Run over all countries, add a row for each country
   for( let code of ordered_countries_codes )
   {
      let country = countries.get(code)
      if ( country == undefined )
        throw RangeError(`country with code '${code}' has no entry in 'countries' (shouldn't happen)`)
      
      let code_cap = code // really needed ?
      let deaths_click_func = function() { OnCountryDeathsClicked( code_cap ) },
          cases_click_func  = function() { OnCountryCasesClicked( code_cap ) }

      let row_element = CreateTableRowElem( country.name,
               country.total_cases, country.total_deaths,
               cases_click_func, deaths_click_func )

      n_table.appendChild( row_element )
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
   // reset Maps & Arrays ( so every other posible reference is updated too)
   countries.clear()
   continents.clear() 
   ordered_countries_codes.length = 0 

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

      // Split CSV line, get 'columns' (array of strings)
      let columns = text_line.split(',')  

      // Create 'continent' object, if this is the first time seen
      let continent_name = columns[10].trim()
      if ( continent_name == null || continent_name == "" )
          continent_name = "Unknown continent"
      
      let continent = continents.get( continent_name )
      if ( continent == undefined )
         continent = new Continent( continent_name ) // adds the object to 'continents'
      
      // Create 'country' object, if this is the first time seen
      let country_code       = columns[8].trim(),  /// 9th column: --> country code
          country_name       = columns[6].trim().replace("_"," "),
          country_population = parseInt(columns[9])

      if ( country_code == null || country_code == "" )
      {   country_code = "UUU"
          country_name = "Unknown country"
      }
      let country = countries.get(country_code)
      if ( country == undefined  )
         country = new Country( country_code, country_name, country_population, continent )

      // Create line, add to array with country lines, accumulate into continent
      let line = new DataLine( columns )
      country.addLine( line )
      continent.accumulateLine( line )

      // accumulate cases in country and continent
      country.total_cases    += line.new_cases
      country.total_deaths   += line.new_deaths
      continent.total_cases  += line.new_cases 
      continent.total_deaths += line.new_deaths 
   }

   // sort 'countries' table according to some criteria (actually deaths, descending)
   ordered_countries_codes.sort( CompareCountriesDeathsDescending )

   // sort every country lines according to date, (re) compute country tables
   for( let code of ordered_countries_codes )
   {  
      let country = countries.get( code )
      if ( country == undefined )
         throw RangeError(`code '${code}' found in 'ordered_countries_codes', but not in 'countries'`)

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

   // for each continent, compute its death and acases tables
   for( let continent of continents.values() )
   {
      //console.log(`about to create tables for continent: [${continent.name}]`)
      continent.deaths_table  = ComputeContinentTable( continent, 'deaths')
      continent.cases_table   = ComputeContinentTable( continent, 'cases')
   }

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
   AddRegionGraphBox( 'Country', country_code, 'deaths' )
}
// --------------------------------------------------------------------------
/**
 * Function called when the user clicks on a country cases number
 */ 
function OnCountryCasesClicked( country_code )
{
   //alert("clicked country: "+country_code+" (on table row)")
   AddRegionGraphBox( 'Country', country_code, 'cases' )
}
// --------------------------------------------------------------------------
/**
 * Function called when the user clicks on a country deaths number
 */ 
function OnContinentDeathsClicked( continent_name )
{
   //console.log(`continent deaths clicked, name == ${continent_name}`)
   AddRegionGraphBox( 'Continent', continent_name, 'deaths' )
   
}
// --------------------------------------------------------------------------
/**
 * Function called when the user clicks on a country cases number
 */ 
function OnContinentCasesClicked( continent_name )
{
   //console.log(`continent cases clicked, name == ${continent_name}`)
   AddRegionGraphBox( 'Continent', continent_name, 'cases' )
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
   alert("An error ocurred while trying to load. Try again later.")
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
 * Function which computes the average values from any table 
 * @param   {Array<Number>} values_arra -- table with values to average
 * @param   {Number} days_averaged       -- num. of days to average (typicaly 7)
 * @return  {Array<Number>}             -- averaged table, with the same length as the original // REVIEW length
*/

function ComputeAvgValues( values_array )
{
   let avg_values = []
   for( let i= 0 ; i < values_array.length ; i++ )
   {
      //let delta  = Math.floor(days_averaged/2)
      let i_first  = Math.max( i-days_averaged+1, 0 )     // first is included in the average
      let i_last   = Math.min( i_first+days_averaged, values_array.length ) // last is not included in the average
      let num_vals = i_last-i_first
      let sum_vals = 0.0

      for( let j = i_first ; j < i_last ; j++ )
         sum_vals += values_array[j]

      avg_values.push(  sum_vals/num_vals )
   }
   return avg_values
}


function TrimPrefix( values_array )
{

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
   let min_value       = 1e+10
   let values          = [] // values table, equal to 'all_values', but excluding a prefix slice with cero values
   let all_values      = [] // all values gathered from this country lines
   
   let nz_values_count = 0  // num of values after first non-zero value in country lines (==values length)
   //let count         = 0
   let week_num        = []
   

   // gather lines values onto 'all_values' array
   for( let i = 0 ; i < country.lines.length ; i++ )
   {
      const v = variable_name == 'deaths' ? country.lines[i].new_deaths : country.lines[i].new_cases
      if ( max_value < v ) max_value = v ;
      if ( v < min_value ) min_value = v ;
      all_values.push( v )
   }
   
   // copy 'all_values' onto 'values', exclusing prefix, compute min/max
   let first_nz_index  = -1 // index of first non-zero value in country lines (-1 if still no non-zero found)

   for( let i = 0 ; i <  all_values.length ; i++ )
   {
      const v = all_values[i]
      if ( 0 < v && nz_values_count == 0 ) 
         first_nz_index = i
      if ( -1 < first_nz_index )  // if we already got to the first non-zero value....
      {  values.push( v )     // register the value in the values array
         week_num.push( country.lines[i].week  )
      }
   }

   //console.log(`ComputeCountryTable: ${country.id}, first_nz_index == ${first_nz_index} `)

   if ( -1 == first_nz_index )
   {  let table = new DataTable()
      table.variable_name  = variable_name    // 'deaths', 'cases', or others...
      table.max_value      = 0
      table.min_value      = 0
      table.values         = []
      table.avg_values     = []
      table.avg_width      = days_averaged
      table.week_num       = []
      return table
   }

   let start_year_day = country.lines[first_nz_index].year_day
   let avg_values = ComputeAvgValues( values )

   let table = new DataTable()

   table.start_year_day = start_year_day    // year day of first number, (year day in 2020)
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
 * Creates a continent table (a table which will be referenced from the continent object)
 * @param {Continent} continent - continent object
 * @param {String}  variable_name -- type of data: ('cases' or 'deaths') 
 */
function ComputeContinentTable( continent, variable_name )
{
   CheckType( continent, 'Continent' )
   CheckDataVariableName( variable_name )

   let max_value       = 0.0
   let values          = []  
   let first_nz_index  = -1 // index of first non-zero value in continent lines (-1 if still no non-zero found)
   let nz_values_count = 0  // num of values after first non-zero value in country lines (==values length)
   let count           = 0
   let week_num        = []

   // gather lines values onto 'values' array
   for( let i = 0 ; i <  continent.lines_map.size ; i++ )
   {
      let value = 0
      let week  = 0
      let line  = continent.lines_map.get(i)

      if ( line != undefined )
      {
         week = line.week
         if ( variable_name == 'deaths')
            value = line.new_deaths
         else
            value = line.new_cases
      }
      else
         week = WeekNum2020( i )

      if ( 0 < value )
      {  if ( nz_values_count == 0 )
            first_nz_index = count
         if ( max_value < value )
            max_value = value
      }
      if ( -1 < first_nz_index )  // if we already got to the first non-zero value....
      {  values.push( value )     // register the value in the values array
         week_num.push( week  )
      }
      count++
   }

   
   //console.log(`ComputeCountryTable: ${country.id}, first_nz_index == ${first_nz_index} `)

   // if no data, return an empty table
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

   let start_year_day = first_nz_index
   let avg_values = ComputeAvgValues( values  )
   let table = new DataTable()

   table.start_year_day = start_year_day    // year day of first number, (year day in 2020)
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

   let tm   = ctx.measureText(text)
   let boxy = tm.actualBoundingBoxAscent + tm.actualBoundingBoxDescent
   let boxx = tm.width
   let m    = 10 // margin in pixels
   let px   = posx
   let py   = posy+((m+boxy)/2)

   ctx.lineWidth = 1
   ctx.fillStyle = 'rgba(100%,100%,100%,0.92)'
   ctx.fillRect( px, py, boxx+m, - boxy-m )

   ctx.fillStyle = 'rgb(50%,50%,50%)'
   ctx.fillText( text, px+(m/2), py-(m/2) )
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

// function DrawCountryTableGraph( country, p_variable_name, ctx, csx, csy )
// {
//    CheckType( country, 'Country' )

//    let table = null
//    if ( p_variable_name == 'cases')
//       table = country.cases_table
//    else if ( p_variable_name == 'deaths' )
//       table = country.deaths_table
//    else
//      throw RangeError(`DrawCountryTableGraph: cannot draw table: variable name is incorrect ('${p_variable_name}')`)

//    CheckType( table, "DataTable" )
//    CheckDataVariableName( table.variable_name )

//    //console.log("DrawTable: begin, max == "+table.max_value+", length== "+table.values.length )
//    let values     = table.values
//    let avg_values = table.avg_values
//    let max_value  = table.max_value   // REVIEW (unnecesary variables, use instance variable directly)

//    // Compute bars colors 'barColor_odd' y 'barColor_even'
//    let r0 = 40.0, g0 = 40.0, b0 = 40.0
//    if ( table.variable_name == 'deaths' ) // increase red for 'deaths'
//       r0 = Math.min( 100.0, 2.5*r0 )

//    let f  = 0.7,
//        t  = (1.0-f)*100.0,
//        r1 = f*r0 + t, 
//        g1 = f*g0 + t, 
//        b1 = f*b0 + t 

//    let barColor_odd  = ColorStr(r0,g0,b0,100.0),
//        barColor_even = ColorStr(r1,g1,b1,100.0)

//    //console.log(" colors == "+barColor_odd+",  "+barColor_even )
//    // draw grid

//    let b = 0
  

//    // compute 'h': vertical spacing between horizontal bars (in units of the table values)
//    // (as a function of 'max_value')

//    let h      = 1,
//        each_h = 1    // one of each 'each_h' horizontal bars have a value label

//    if ( 15 < max_value  )
//    {  
//       let l = 1+ Math.floor(Math.log10( max_value/10 ))
//       h = Math.pow( 10, l )
//       each_h = 2
//       if ( max_value/h < 5 )
//          h = h/5
//       //console.log(`DrawCountryTableGraph: h = ${h}, max_value = ${max_value}`)
//    }
   
//    // compute the font size for the number labels,
//    // as a function of 'csx' and 'csy'
//    let min_dim   = Math.min( csx, csy ),
//        font_size = Math.min( 20, Math.round( Math.max( 12, min_dim/20 )))

//    let h_count = 0

//    let margin_x = 0.05*csx // margin for the bars at left and right of the canvas (<csx)
//    let margin_y = 0.05*csy // margin for the bars at the top and the bottom (<csy)
//    let sfac_y   = csy-2.0*margin_y // scale factor in Y, accounting for the margin for margin
//    let y0       = csy-margin_y  // 'y' for a zero value
//    let dist_x   = (csx-2.0*margin_x)/values.length // dist in x between bars centers
//    let cur_x    = margin_x+ 0.5*dist_x   // current 'x'
//    let bwf      = 0.7    // ratio of horiz. distance between bars which is ocuppied by the bars (<1.0)
//    let hbw      = bwf*(0.5*dist_x)      // half bar width

//    // draw the horizontal bars, and their labels to the left

//    for( cur_y = 0 ; cur_y <= max_value ; cur_y = cur_y + h )
//    {
//       let py = y0 - sfac_y*(cur_y/max_value)
//       ctx.beginPath()
//       ctx.moveTo(b,py); ctx.lineTo(csx,py)
//       ctx.lineWidth = 1
//       ctx.strokeStyle = 'rgb(180,180,180)'
//       ctx.stroke()

//       //if ( h_count > 0 )
//       if ( h_count % each_h == 0 )
//          DrawText( ctx, font_size, b, py, cur_y.toString() )
//       h_count = h_count+1
//    }

//    // draw values bar
//    ctx.fillStyle = 'rgb(240,100,100)'
//    for( let i = 0 ; i < values.length ; i++  )
//    {
//       let v = values[i]/max_value
//       if ( (table.week_num[i] % 2) == 0 )
//          ctx.fillStyle = barColor_even //'rgb(240,100,100)'
//       else
//          ctx.fillStyle = barColor_odd // 'rgb(256,150,150)'
//       ctx.fillRect( cur_x-hbw, y0, 2.0*hbw, -v*sfac_y )
//       cur_x = cur_x+dist_x

//       //console.log("DrawTable, i == "+(i.toString())+", val == "+(values[i].toString())+", avg.val == "+(avg_values[i].toString()))
//    }

//    // draw average curve
//    ctx.lineWidth = 4
//    ctx.strokeStyle = 'rgb(30.123%,0%,0%)'
//    let first = true ;

//    ctx.beginPath()
//    cur_x = margin_x+ 0.5*dist_x
//    for( let i = 0 ; i < avg_values.length ; i++ )
//    {
//       let v  = avg_values[i]/max_value,
//           px = cur_x, 
//           py = y0 - v*sfac_y

//       if ( i == 0 ) ctx.moveTo( px, py )
//       else          ctx.lineTo( px, py )

//       cur_x = cur_x + dist_x
//    }

//    ctx.stroke()

//    // debug: text
//    let debug_text = false
//    if ( debug_text )
//    {
//       ctx.font = "32px Trebuchet MS";
//       let text = "Hello World !"
//       let tm = ctx.measureText(text)
//       let boxy = tm.actualBoundingBoxAscent + tm.actualBoundingBoxDescent
//       let boxx = tm.width

//       ctx.lineWidth = 1
//       ctx.fillStyle = 'rgba(100%,100%,100%,0.92)'
//       ctx.fillRect( csx/2-10, csy/2+10, boxx+20, - boxy-20)

//       ctx.strokStyle = 'rgb(100,0,0)'
//       ctx.lineWidth = 2
//       ctx.strokeRect( csx/2-10, csy/2+10, boxx+20, - boxy-20)

//       //console.log("m. x == "+boxx+" px?, y = "+boxy+" px?")

//       ctx.fillStyle = 'rgb(0%,0%,20%)'
//       ctx.fillText("Hello World!", csx/2, csy/2)
//    }

// }

// ------------------------------------------------------------------------
/**  
 * Draws a country or a continent graph 
 * @param {Country or Continent} region - instance of either 'Continent' or 'Country'
 * @param {String}  p_variable_name - name of country's variable to show ('cases','deaths')
 * @param {CanvasRenderingContext2D} ctx - canvas context object where to draw onto
 * @param {Number} - integer, width of the canvas
 * @param {Number} - integer, height of the canvas
 */

function DrawRegionTableGraph( region, p_variable_name, ctx, csx, csy )
{
   //CheckType( country, 'Country' )

   let region_class = region.constructor.name
   if ( region_class != 'Country' && region_class != 'Continent')
      throw TypeError(`'region' is of unexpected class '${region_class}', should be 'Country' or 'Continent'`) 

   if ( region.cases_table == undefined || region.deaths_table == undefined ||
      region.cases_table == null || region.deaths_table == null ) 
   {  alert("this country or continent does not have deaths or cases table. Sorry.")
      return
   }

   let table = null
   if ( p_variable_name == 'cases')
      table = region.cases_table
   else if ( p_variable_name == 'deaths' )
      table = region.deaths_table
   else
     throw RangeError(`DrawRegionTableGraph: cannot draw table: variable name is incorrect ('${p_variable_name}')`)

   CheckType( table, "DataTable" )
   CheckDataVariableName( table.variable_name )

   //console.log("DrawTable: begin, max == "+table.max_value+", length== "+table.values.length )
   let values     = table.values
   let avg_values = table.avg_values
   let max_value  = table.max_value   // REVIEW (unnecesary variables, use instance variable directly)

   // Compute bars colors 'barColor_odd' y 'barColor_even'
   let r0 = 50.0, 
       g0 = 50.0, 
       b0 = 50.0

   if ( table.variable_name == 'deaths' ) // increase red for 'deaths'
   {   r0 = 100,
       g0 = 50,
       b0 = 50
   }

   const f  = 0.7,
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
   DrawRegionTableGraph( box_data.region,  box_data.variable_name, ctx_aux, canv_doc.width, canv_doc.height )
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
   n_head.innerHTML   = box_data.region_class +": <b>"+box_data.region.name+"</b> ("+box_data.variable_name+")"
   n_close.className  = 'graph-close'
   n_close.onclick    = function(){ RemoveGraphBox(ng) }  // capture ng ?? (yes)
   n_close.innerHTML  = 'Close'
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
// // -------------------------------------------------------------------------
// /**
//  * Add a new country graph box to the page
//  * @param {String} p_country_code -- three letters country code 
//  * @param {String} variable_name  -- 'cases' or 'deaths'
//  */
// function AddCountryGraphBox( p_country_code, variable_name )
// {
//    if ( ordered_countries_codes.length == 0 )
//    {  
//       if ( loading )
//          alert("Please wait for the data to be fully loaded.")
//       else
//          alert("Please load data before adding a graph.")
//       return
//    }
//    CheckDataVariableName( variable_name )

//    // check country code
//    let country_code ='ESP'
//    if ( p_country_code != null && p_country_code != "" )
//       country_code = p_country_code

   
//    //if ( countries[country_code] == null )  /// REVIEW (OK): 'countries' created as a 'Map' but not used as a Map
//    //{  alert("Error! - AddCountryGraphBox: country code '"+country_code+"' not found.")
//    //   return
//    //}
//    let country = countries.get( country_code )
//    if ( country == undefined )
//       throw RangeError(`country code '${country_code}' not found in countries array`)

//    // create a 'box data' object, this creates DOM objects and event handlers..

//    let box_data = new GraphBoxData( country, variable_name )
// }

// -------------------------------------------------------------------------
/**
 * Add a new country or continent graph box to the page
 * @param {String} p_region_class -- must be 'Country' or 'Continent'
 * @param {String} p_region_code -- for countries: three letters code, for continents: name
 * @param {String} variable_name  -- 'cases' or 'deaths'
 */
function AddRegionGraphBox( p_region_class, p_region_code, variable_name )
{
  
   if ( ordered_countries_codes.length == 0 )
   {  
      if ( loading )
         alert("Please wait for the data to be fully loaded.")
      else
         alert("Please load data before adding a graph.")
      return
   }
   CheckDataVariableName( variable_name )

   if ( p_region_class == 'Country' )
   {
      let country_code ='ESP'
      if ( p_region_code != null && p_region_code != "" )
         country_code = p_region_code

      let country = countries.get( country_code )
      if ( country == undefined )
         throw RangeError(`country code '${country_code}' not found in countries array`)

      // create a 'box data' object, this creates DOM objects and event handlers..
      let box_data = new GraphBoxData( country, variable_name )
   }
   else if ( p_region_class == 'Continent' )
   {
      let continent_name = p_region_code
      let continent = continents.get( continent_name )
      if ( continent == undefined )
         throw RangeError(`country code '${country_code}' not found in countries array`)
      // create a 'box data' object, this creates DOM objects and event handlers..
      let box_data = new GraphBoxData( continent, variable_name )
   }
   else
      throw RangeError(`'p_region_class' is '${p_region_class}', should be 'Country' or 'Continent'`)
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
