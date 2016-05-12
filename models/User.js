var mongoose = require('mongoose');



var userSchema = new mongoose.Schema({
	sender: Number,
	status: {type: String, default: 'INITIAL'},
	stocks: [String],
	channels: [String]
});

var User = mongoose.model('User', userSchema);

module.exports = User;
