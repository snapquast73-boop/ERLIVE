(function (global) {
  'use strict';

  const PRIMARY_PENDING = 'os_ruling_pending_primary';

  function classifyReview(reviewDetails, eventDetails) {
    const code = (reviewDetails && reviewDetails.reviewType) || '';
    const description = ((eventDetails && eventDetails.description) || (reviewDetails && reviewDetails.reason) || '').toLowerCase();

    if (code === 'MJ' || description.includes('abs') || description.includes('ball-strike')) {
      return { category: 'abs', label: 'ABS Challenge' };
    }
    if (code === 'MA' || code === 'MF' || description.includes('manager challenge')) {
      return { category: 'challenge', label: 'Manager Challenge' };
    }
    if (description.includes('boundary') || description.includes('home run')) {
      return { category: 'boundary', label: 'Boundary Call' };
    }
    if (description.includes('crew chief') || description.includes('umpire')) {
      return { category: 'review', label: 'Umpire / Crew Chief Review' };
    }
    return { category: 'review', label: 'Replay Review' };
  }

  function extractGameReviews(feed) {
    if (!feed || !feed.liveData || !feed.liveData.plays) return [];
    const plays = feed.liveData.plays.allPlays || [];
    const gameData = feed.gameData || {};
    const gamePk = gameData.game && gameData.game.pk != null ? gameData.game.pk : null;
    const away = (gameData.teams && gameData.teams.away) || {};
    const home = (gameData.teams && gameData.teams.home) || {};
    const items = [];

    plays.forEach((play, playIdx) => {
      const about = play.about || {};
      const result = play.result || {};
      const runners = play.runners || [];
      const events = play.playEvents || [];
      const batter = play.matchup && play.matchup.batter ? play.matchup.batter.fullName : '';
      const pitcher = play.matchup && play.matchup.pitcher ? play.matchup.pitcher.fullName : '';
      const common = {
        gamePk,
        awayAbbr: away.abbreviation || '',
        homeAbbr: home.abbreviation || '',
        inning: about.inning,
        halfInning: about.halfInning,
        batter,
        pitcher,
        awayScore: result.awayScore,
        homeScore: result.homeScore,
        timestamp: about.endTime || about.startTime || '',
      };

      const checkReview = (reviewDetails, event, eventIdx) => {
        if (!reviewDetails) return;
        const eventDetails = event && event.details ? event.details : null;
        const classification = classifyReview(reviewDetails, eventDetails);
        const isOverturned = reviewDetails.isOverturned === true;
        const overturnedKnown = typeof reviewDetails.isOverturned === 'boolean';
        const inProgressKnown = typeof reviewDetails.inProgress === 'boolean';
        const inProgress = reviewDetails.inProgress === true;
        const scoringRunners = runners.filter((runner) => {
          if (!runner.details || runner.details.isScoringEvent !== true) return false;
          return eventIdx === null || runner.details.playIndex === eventIdx;
        });
        const idSuffix = eventIdx === null ? 'play' : `event-${eventIdx}`;

        items.push({
          ...common,
          id: `${gamePk || 'g'}-${playIdx}-review-${idSuffix}`,
          category: classification.category,
          label: classification.label,
          reason: reviewDetails.reason || (eventDetails && eventDetails.description) || result.description || '',
          inProgress,
          isOverturned,
          outcome: inProgress ? 'Under Review' : isOverturned ? 'Overturned' : inProgressKnown && overturnedKnown ? 'Call Stands / Confirmed' : 'Outcome unavailable — unverified',
          runsAtRisk: inProgress ? scoringRunners.length : 0,
        });
      };

      if (play.reviewDetails) checkReview(play.reviewDetails, null, null);

      // A primary field error is the result's event type, not a phrase in its
      // description. Fielder's-choice plays mentioning an error are not counted.
      if (result.eventType === 'field_error') {
        items.push({
          ...common,
          id: `${gamePk || 'g'}-${playIdx}-field-error`,
          category: 'error',
          label: 'Field Error',
          reason: result.description || '',
          inProgress: false,
          isOverturned: false,
          outcome: 'Official result',
          runsAtRisk: 0,
        });
      }

      // Keep the primary plate-appearance pending marker only. The similarly
      // named *_prior marker is a prior/base-running event, not a primary
      // scorer ruling. Accept the result or event location but emit one row.
      const primaryPendingEvent = events.find((event) => event.details && event.details.eventType === PRIMARY_PENDING);
      const hasPrimaryPending = result.eventType === PRIMARY_PENDING || Boolean(primaryPendingEvent);
      if (hasPrimaryPending) {
        items.push({
          ...common,
          id: `${gamePk || 'g'}-${playIdx}-os-primary-pending`,
          category: 'os_pending',
          label: 'Official Scorer Ruling Pending',
          reason: (primaryPendingEvent && primaryPendingEvent.details.description) || result.description || '',
          inProgress: true,
          isOverturned: false,
          outcome: 'Pending',
          runsAtRisk: 0,
        });
      }

      events.forEach((event, eventIdx) => {
        if (event.reviewDetails) checkReview(event.reviewDetails, event, eventIdx);
      });
    });

    return items;
  }

  global.Reviews = {
    classifyReview,
    extractGameReviews,
  };
})(window);
