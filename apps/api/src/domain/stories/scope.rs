use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::arcs;
use crate::domain::universes;
use crate::error::AppError;

/// Ensures optional universe/arc references belong to the authenticated user.
pub async fn validate_scope(
    pool: &PgPool,
    user_id: Uuid,
    universe_id: Option<Uuid>,
    arc_id: Option<Uuid>,
) -> Result<(), AppError> {
    let resolved_universe_id = match (universe_id, arc_id) {
        (_, Some(arc_id)) => {
            let arc = arcs::find_by_id(pool, arc_id)
                .await
                .map_err(AppError::from_db)?
                .ok_or(AppError::NotFound)?;
            let universe = universes::find_by_id(pool, arc.universe_id)
                .await
                .map_err(AppError::from_db)?
                .ok_or(AppError::NotFound)?;
            if universe.owner_id != user_id {
                return Err(AppError::unauthorized());
            }
            if let Some(expected) = universe_id {
                if expected != arc.universe_id {
                    return Err(AppError::BadRequest(
                        "arc does not belong to the specified universe".into(),
                    ));
                }
            }
            Some(arc.universe_id)
        }
        (Some(universe_id), None) => {
            let universe = universes::find_by_id(pool, universe_id)
                .await
                .map_err(AppError::from_db)?
                .ok_or(AppError::NotFound)?;
            if universe.owner_id != user_id {
                return Err(AppError::unauthorized());
            }
            Some(universe_id)
        }
        (None, None) => None,
    };

    let _ = resolved_universe_id;
    Ok(())
}
