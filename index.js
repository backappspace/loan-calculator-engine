"use strict";

var _inherits = function (child, parent) {
  child.prototype = Object.create(parent && parent.prototype, {
    constructor: {
      value: child,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (parent) child.__proto__ = parent;
};

"use strict";

var _ = require("lodash");

var CalculatorEngine = require("financial-calculator-engine"), CalculatorEngineMath = require("financial-calculator-engine/math");

var LoanContext = function LoanContext(context) {
  var config = CalculatorEngine.config();

  this.principal = 0;
  this.interestRate = 0;
  this.interestRateFrequency = config.frequency.year;
  this.term = 0;
  this.termFrequency = config.frequency.year;
  this.repaymentFrequency = config.frequency.month;

  _.merge(this, context);
};

// Calculate the interest rate per period.
LoanContext.prototype.getEffInterestRate = function () {
  return this.interestRate * this.interestRateFrequency / this.repaymentFrequency;
};

// Calculate the total number of periods for a given loan.
LoanContext.prototype.getEffTerm = function () {
  return this.term / this.termFrequency * this.repaymentFrequency;
};

//
var LoanSummaryItem = function LoanSummaryItem(periodAt) {
  this.period = periodAt;
  this.principalInitialBalance = 0;
  this.principalFinalBalance = 0;
  this.interestPaid = 0;
  this.principalPaid = 0;
  this.pmt = 0;
};

//
var LoanCalculatorEngine = (function () {
  var _CalculatorEngine = CalculatorEngine;
  var LoanCalculatorEngine = function LoanCalculatorEngine(context) {
    _CalculatorEngine.call(this);

    this.__baseContext = new LoanContext(context);
  };

  _inherits(LoanCalculatorEngine, _CalculatorEngine);

  LoanCalculatorEngine.prototype.__flattenContext = function (operatorsContextList) {
    // Instanciate new context
    var target = new LoanContext();

    // Create an array with all contexts to be flattened
    // [target, __baseContext, ...operatorContext]
    var contextStack = [target, this.__baseContext].concat(operatorsContextList);

    // Flatten contexts by merging/assigning all properties into the target context
    _.merge.apply(_, contextStack);

    // Return the target object
    return target;
  };

  LoanCalculatorEngine.prototype.getContextAt = function (period) {
    var operatorsList = this.getOperatorsAt(period);

    // Extract contexts from operators list
    var operatorsContextList = operatorsList.map(function (operator) {
      return operator.context;
    });

    return this.__flattenContext(operatorsContextList);
  };

  LoanCalculatorEngine.prototype.calculate = function () {
    var numberOfPeriods = this.__baseContext.getEffTerm();

    var summaryList = [], summaryItem, previousSummaryItem;

    for (var currentPeriod = 1; currentPeriod <= numberOfPeriods; currentPeriod++) {
      if (currentPeriod > 1) {
        previousSummaryItem = summaryList[summaryList.length - 1];
      }

      // Assign the `previous principal final balance` from the summary,
      // Use the loan principal amount instead if it's the first period (ie. no previous summary)
      var previousPrincipalFinalBalance = previousSummaryItem ? previousSummaryItem.principalFinalBalance : this.__baseContext.principal;

      // Select the current context
      // It will take all active operators in account
      var currentContext = this.getContextAt(currentPeriod);

      // Calculate repayment amount (ie. pmt)
      var interestRate = currentContext.getEffInterestRate(), numberOfPeriodsLeft = numberOfPeriods - currentPeriod + 1;

      var pmt = CalculatorEngineMath.pmt(previousPrincipalFinalBalance, interestRate, numberOfPeriodsLeft);

      // Create summary item
      summaryItem = new LoanSummaryItem(currentPeriod);
      summaryItem.principalInitialBalance = previousPrincipalFinalBalance;
      summaryItem.pmt = pmt;
      summaryItem.interestPaid = summaryItem.principalInitialBalance * interestRate;
      summaryItem.principalPaid = summaryItem.pmt - summaryItem.interestPaid;
      summaryItem.principalFinalBalance = summaryItem.principalInitialBalance - summaryItem.principalPaid;
      summaryList.push(summaryItem);
    }

    // Sum totals
    var totals = summaryList.reduce(function (previous, current) {
      return {
        pmt: previous.pmt + current.pmt,
        interestPaid: previous.interestPaid + current.interestPaid
      };
    });

    return {
      summaryList: summaryList,
      totals: totals
    };
  };

  return LoanCalculatorEngine;
})();

module.exports = LoanCalculatorEngine;